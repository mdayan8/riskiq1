import express from "express";
import path from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import { MongoClient } from "mongodb";
import pg from "pg";
import { pgPool } from "../db/postgres.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { upload } from "../utils/upload.js";
import { runWorkflow, runWorkflowWithHooks } from "../services/orchestrator.js";
import { scrapeRegulatoryKnowledge } from "../services/knowledgeScraper.js";
import { generateCombinedReport, generateReport, sessionCopilot } from "../services/aiService.js";
import {
  completeWorkflowJob,
  createWorkflowJob,
  failWorkflowJob,
  getWorkflowJob,
  markStage
} from "../services/workflowJobs.js";

const router = express.Router();
const sessionCopilotCache = new Map();
const SESSION_COPILOT_CACHE_TTL_MS = 2 * 60 * 1000;

function summarizeSimulation(submissionRows, sessions) {
  const scoreValues = submissionRows
    .map((s) => Number(s.score))
    .filter((v) => Number.isFinite(v));
  const confidenceValues = submissionRows
    .map((s) => Number(s.confidence))
    .filter((v) => Number.isFinite(v));

  const riskBuckets = { HIGH: 0, MEDIUM: 0, LOW: 0, NA: 0 };
  let totalViolations = 0;
  const breachCounts = new Map();

  for (const row of submissionRows) {
    const bucket = String(row.risk_category || "NA").toUpperCase();
    if (!riskBuckets[bucket]) riskBuckets[bucket] = 0;
    riskBuckets[bucket] += 1;
    totalViolations += Number(row.violations || 0);
  }

  for (const session of sessions) {
    const violations = session.result_json?.compliance?.violations || [];
    for (const v of violations) {
      const key = v?.rule_id || "UNKNOWN";
      breachCounts.set(key, (breachCounts.get(key) || 0) + 1);
    }
  }

  const top_rule_breaches = [...breachCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([rule_id, count]) => ({ rule_id, count }));

  const avgScore = scoreValues.length
    ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
    : 0;
  const avgConfidence = confidenceValues.length
    ? confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length
    : 0;

  const readinessRaw = Math.max(
    0,
    Math.min(100, 100 - (totalViolations * 1.75 + riskBuckets.HIGH * 9 + riskBuckets.MEDIUM * 4))
  );
  const readiness = Math.round(readinessRaw);
  const verdict =
    readiness >= 75 ? "READY_WITH_STANDARD_REVIEW" :
    readiness >= 50 ? "CONDITIONAL_READY_REQUIRES_REMEDIATION" :
    "NOT_READY_REQUIRES_MAJOR_REMEDIATION";

  const headline = verdict === "READY_WITH_STANDARD_REVIEW"
    ? "Submission posture is stable with manageable residual risk."
    : verdict === "CONDITIONAL_READY_REQUIRES_REMEDIATION"
      ? "Submission can proceed after targeted remediation of key breaches."
      : "Submission is not yet ready and needs major remediation before filing.";

  return {
    sessions_analyzed: submissionRows.length,
    average_score: Number(avgScore.toFixed(4)),
    average_score_pct: Number((avgScore * 100).toFixed(1)),
    average_confidence: Number(avgConfidence.toFixed(4)),
    average_confidence_pct: Number((avgConfidence * 100).toFixed(1)),
    total_violations: totalViolations,
    risk_mix: riskBuckets,
    top_rule_breaches,
    readiness_index: readiness,
    verdict,
    headline,
    easy_read_points: [
      `${riskBuckets.HIGH} high-risk document(s), ${riskBuckets.MEDIUM} medium-risk document(s), ${riskBuckets.LOW} low-risk document(s).`,
      `${totalViolations} total compliance violation(s) found across selected sessions.`,
      `Average model confidence is ${Number((avgConfidence * 100).toFixed(1))}%.`,
      `Readiness index is ${readiness}/100 (${verdict}).`
    ]
  };
}

async function ensureSessionReportForUser(session, userId) {
  const resultJson = session.result_json || {};
  const documentRef = resultJson.document_id;
  if (!documentRef) {
    throw new Error("Session has no generated document reference");
  }

  if (resultJson.report_id) {
    const existing = await pgPool.query(
      `SELECT id, document_ref, report_path, report_type, created_at
       FROM reports_metadata
       WHERE user_id = $1 AND id = $2
       LIMIT 1`,
      [userId, resultJson.report_id]
    );
    if (existing.rowCount > 0) {
      return existing.rows[0];
    }
  }

  if (!resultJson.extracted_data || !resultJson.compliance || !resultJson.decision) {
    throw new Error("Session output incomplete for report generation");
  }

  const reportData = await generateReport({
    document_ref: documentRef,
    document_name: session.file_name,
    structured_data: resultJson.extracted_data,
    compliance: resultJson.compliance,
    decision: resultJson.decision,
    alerts: resultJson.alerts || [],
    suggestions: resultJson.suggestions || [],
    standard_references: resultJson.standard_references || [],
    models_used: resultJson.models_used || []
  });

  const reportInsert = await pgPool.query(
    `INSERT INTO reports_metadata (user_id, document_ref, report_path, report_type)
     VALUES ($1, $2, $3, $4)
     RETURNING id, document_ref, report_path, report_type, created_at`,
    [userId, documentRef, reportData.report_path, "PDF"]
  );

  const mergedResult = {
    ...resultJson,
    report_id: reportInsert.rows[0].id,
    report_path: reportData.report_path,
    report_ready: true
  };

  await pgPool.query(
    `UPDATE workflow_sessions
     SET result_json = $3::jsonb, updated_at = NOW()
     WHERE id = $1 AND user_id = $2`,
    [session.id, userId, JSON.stringify(mergedResult)]
  );

  return reportInsert.rows[0];
}

router.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

router.post("/upload", requireAuth, upload.single("document"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Missing document file" });
    }

    const result = await runWorkflow({
      filePath: req.file.path,
      originalName: req.file.originalname,
      userId: req.user.id
    });

    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/upload-async", requireAuth, upload.single("document"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Missing document file" });
    }

    const job = createWorkflowJob({
      userId: req.user.id,
      fileName: req.file.originalname
    });

    await pgPool.query(
      `INSERT INTO workflow_sessions (id, user_id, file_name, status, current_stage, stages_json, result_json, error_text)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NULL, NULL)`,
      [job.job_id, req.user.id, req.file.originalname, job.status, job.current_stage, JSON.stringify(job.stages)]
    );

    runWorkflowWithHooks({
      filePath: req.file.path,
      originalName: req.file.originalname,
      userId: req.user.id,
      onStage: async ({ stage, status, message }) => {
        markStage(job.job_id, stage, status, message);
        const latest = getWorkflowJob(job.job_id, req.user.id);
        if (latest) {
          await pgPool.query(
            `UPDATE workflow_sessions
             SET status = $2, current_stage = $3, stages_json = $4::jsonb, updated_at = NOW()
             WHERE id = $1 AND user_id = $5`,
            [job.job_id, latest.status, latest.current_stage, JSON.stringify(latest.stages), req.user.id]
          );
        }
      }
    })
      .then(async (result) => {
        completeWorkflowJob(job.job_id, result);
        const latest = getWorkflowJob(job.job_id, req.user.id);
        await pgPool.query(
          `UPDATE workflow_sessions
           SET status = $2, current_stage = $3, stages_json = $4::jsonb, result_json = $5::jsonb, error_text = NULL, updated_at = NOW()
           WHERE id = $1 AND user_id = $6`,
          [
            job.job_id,
            latest?.status || "completed",
            latest?.current_stage || "DONE",
            JSON.stringify(latest?.stages || []),
            JSON.stringify(result),
            req.user.id
          ]
        );
      })
      .catch((error) => {
        console.error(error);
        const stage = job.current_stage || "INGESTION";
        markStage(job.job_id, stage, "failed", error.message);
        failWorkflowJob(job.job_id, error.message);
        const latest = getWorkflowJob(job.job_id, req.user.id);
        pgPool.query(
          `UPDATE workflow_sessions
           SET status = $2, current_stage = $3, stages_json = $4::jsonb, error_text = $5, updated_at = NOW()
           WHERE id = $1 AND user_id = $6`,
          [
            job.job_id,
            latest?.status || "failed",
            latest?.current_stage || stage,
            JSON.stringify(latest?.stages || []),
            error.message,
            req.user.id
          ]
        ).catch((dbError) => console.error(dbError));
      });

    return res.status(202).json({
      job_id: job.job_id,
      status: job.status,
      stages: job.stages
    });
  } catch (error) {
    next(error);
  }
});

router.get("/workflow-status/:jobId", requireAuth, async (req, res, next) => {
  try {
    const job = getWorkflowJob(req.params.jobId, req.user.id);
    if (!job) {
      return res.status(404).json({ error: "Workflow job not found" });
    }
    return res.json(job);
  } catch (error) {
    next(error);
  }
});

router.get("/sessions", requireAuth, async (req, res, next) => {
  try {
    const result = await pgPool.query(
      `SELECT id, file_name, status, current_stage, created_at, updated_at,
              result_json->>'document_id' AS document_id
       FROM workflow_sessions
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [req.user.id]
    );
    return res.json({ sessions: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get("/sessions/:id", requireAuth, async (req, res, next) => {
  try {
    const result = await pgPool.query(
      `SELECT id, file_name, status, current_stage, stages_json, result_json, error_text, created_at, updated_at
       FROM workflow_sessions
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Session not found" });
    }
    return res.json({ session: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.post("/knowledge-base/refresh", requireAuth, requireRole("Admin"), async (_req, res, next) => {
  try {
    const entries = await scrapeRegulatoryKnowledge();
    for (const item of entries) {
      await pgPool.query(
        `INSERT INTO compliance_knowledge (
          source_id, framework, regulator, jurisdiction, title, issued_on, status,
          source_url, summary, tags, mandatory_checks
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::text[],$11::text[])
        ON CONFLICT (source_id)
        DO UPDATE SET
          framework = EXCLUDED.framework,
          regulator = EXCLUDED.regulator,
          jurisdiction = EXCLUDED.jurisdiction,
          title = EXCLUDED.title,
          issued_on = EXCLUDED.issued_on,
          status = EXCLUDED.status,
          source_url = EXCLUDED.source_url,
          summary = EXCLUDED.summary,
          tags = EXCLUDED.tags,
          mandatory_checks = EXCLUDED.mandatory_checks,
          updated_at = NOW()`,
        [
          item.source_id,
          item.framework,
          item.regulator,
          item.jurisdiction,
          item.title,
          item.issued_on,
          item.status,
          item.source_url,
          item.summary,
          item.tags,
          item.mandatory_checks
        ]
      );
    }
    return res.json({ status: "refreshed", sources: entries.map((e) => ({ source_id: e.source_id, source_url: e.source_url, refreshed_at: e.refreshed_at })) });
  } catch (error) {
    next(error);
  }
});

router.get("/dashboard", requireAuth, async (req, res, next) => {
  try {
    const [docCount, openAlerts, scoreTrend, fraudTrend, compliance] = await Promise.all([
      pgPool.query("SELECT COUNT(*)::int AS total FROM decision_scores WHERE user_id = $1", [req.user.id]),
      pgPool.query("SELECT severity, COUNT(*)::int AS total FROM alerts WHERE user_id = $1 GROUP BY severity", [req.user.id]),
      pgPool.query(
        `SELECT date_trunc('day', created_at) AS day, AVG(score)::numeric(10,2) AS avg_score
         FROM decision_scores
         WHERE user_id = $1
         GROUP BY day
         ORDER BY day ASC`,
        [req.user.id]
      ),
      pgPool.query(
        `SELECT date_trunc('day', created_at) AS day, AVG(COALESCE(fraud_score, 0))::numeric(10,2) AS avg_fraud_score
         FROM decision_scores
         WHERE user_id = $1
         GROUP BY day
         ORDER BY day ASC`,
        [req.user.id]
      ),
      pgPool.query(
        `SELECT status, COUNT(*)::int AS total
         FROM compliance_results
         WHERE user_id = $1
         GROUP BY status`,
        [req.user.id]
      )
    ]);

    return res.json({
      total_documents_analyzed: docCount.rows[0]?.total ?? 0,
      alerts_by_severity: openAlerts.rows,
      score_trend: scoreTrend.rows,
      fraud_trend: fraudTrend.rows,
      compliance_distribution: compliance.rows
    });
  } catch (error) {
    next(error);
  }
});

router.get("/alerts", requireAuth, async (req, res, next) => {
  try {
    const result = await pgPool.query(
      `SELECT id, severity, message, source, document_ref, created_at
       FROM alerts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    return res.json({ alerts: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get("/compliance-knowledge", requireAuth, async (req, res, next) => {
  try {
    const { regulator, framework, q } = req.query;
    const params = [];
    let where = "1=1";
    let idx = 0;

    if (regulator) {
      idx += 1;
      params.push(String(regulator));
      where += ` AND regulator = $${idx}`;
    }

    if (framework) {
      idx += 1;
      params.push(String(framework));
      where += ` AND framework = $${idx}`;
    }

    if (q) {
      idx += 1;
      params.push(`%${String(q)}%`);
      where += ` AND (title ILIKE $${idx} OR summary ILIKE $${idx})`;
    }

    const [knowledge, rules, prompts] = await Promise.all([
      pgPool.query(
        `SELECT source_id, framework, regulator, jurisdiction, title, issued_on, status, source_url, summary, tags, mandatory_checks
         FROM compliance_knowledge
         WHERE ${where}
         ORDER BY regulator, title`
      , params),
      pgPool.query(
        `SELECT external_rule_id, regulator, description, field_name, requirement, severity
         FROM rules
         ORDER BY external_rule_id`
      ),
      pgPool.query(
        `SELECT agent_name, objective, system_prompt, input_contract, output_contract, updated_at
         FROM agent_prompts
         ORDER BY agent_name`
      )
    ]);

    return res.json({
      knowledge_items: knowledge.rows,
      rules: rules.rows,
      agents: prompts.rows
    });
  } catch (error) {
    next(error);
  }
});

router.get("/agent-runs/:documentRef", requireAuth, async (req, res, next) => {
  try {
    const result = await pgPool.query(
      `SELECT id, agent_name, status, output_json, created_at
       FROM agent_runs
       WHERE user_id = $1 AND document_ref = $2
       ORDER BY id ASC`,
      [req.user.id, req.params.documentRef]
    );
    return res.json({ runs: result.rows });
  } catch (error) {
    next(error);
  }
});

const reportSchema = z.object({ document_ref: z.string().min(1) });

router.post("/report", requireAuth, async (req, res, next) => {
  try {
    const payload = reportSchema.parse(req.body);
    const result = await pgPool.query(
      `SELECT report_path
       FROM reports_metadata
       WHERE user_id = $1 AND document_ref = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user.id, payload.document_ref]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.json({ report_path: result.rows[0].report_path });
  } catch (error) {
    next(error);
  }
});

router.get("/reports", requireAuth, async (req, res, next) => {
  try {
    const result = await pgPool.query(
      `SELECT
         id, document_ref, report_path, report_type, created_at
       FROM reports_metadata
       WHERE user_id = $1
       ORDER BY created_at DESC
      `,
      [req.user.id]
    );
    return res.json({ reports: result.rows });
  } catch (error) {
    next(error);
  }
});

const connectSchema = z.object({
  type: z.enum(["postgres", "mongodb", "csv", "excel", "api", "manual"]),
  name: z.string().min(2),
  config: z.record(z.any())
});

router.post("/connect-database", requireAuth, async (req, res, next) => {
  try {
    const payload = connectSchema.parse(req.body);
    const steps = [];
    steps.push({ step: "request-validated", status: "completed" });

    if (payload.type === "postgres" && payload.config.connectionString) {
      steps.push({ step: "postgres-test-connection", status: "running" });
      const client = new pg.Client({ connectionString: payload.config.connectionString });
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      steps[steps.length - 1] = { step: "postgres-test-connection", status: "completed" };
    }

    if (payload.type === "mongodb" && payload.config.uri) {
      steps.push({ step: "mongodb-test-connection", status: "running" });
      const client = new MongoClient(payload.config.uri);
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      await client.close();
      steps[steps.length - 1] = { step: "mongodb-test-connection", status: "completed" };
    }

    await pgPool.query(
      `INSERT INTO data_source_connections (user_id, type, name, config_json)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [req.user.id, payload.type, payload.name, JSON.stringify(payload.config)]
    );

    steps.push({ step: "saved", status: "completed" });
    return res.status(201).json({ status: "connected", steps });
  } catch (error) {
    next(error);
  }
});

router.get("/data-sources", requireAuth, async (req, res, next) => {
  try {
    const result = await pgPool.query(
      `SELECT id, type, name, config_json, created_at
       FROM data_source_connections
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json({ sources: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get("/reports/:id/download", requireAuth, async (req, res, next) => {
  try {
    const result = await pgPool.query(
      `SELECT report_path
       FROM reports_metadata
       WHERE user_id = $1 AND id = $2`,
      [req.user.id, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    const absolute = path.resolve(process.cwd(), "..", result.rows[0].report_path);
    return res.download(absolute);
  } catch (error) {
    next(error);
  }
});

router.get("/reports/by-document/:documentRef/latest", requireAuth, async (req, res, next) => {
  try {
    const result = await pgPool.query(
      `SELECT id, document_ref, report_path, created_at
       FROM reports_metadata
       WHERE user_id = $1 AND document_ref = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [req.user.id, req.params.documentRef]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Report not found" });
    }
    return res.json({ report: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.post("/sessions/:id/report", requireAuth, async (req, res, next) => {
  try {
    const sessionResult = await pgPool.query(
      `SELECT id, file_name, result_json
       FROM workflow_sessions
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (sessionResult.rowCount === 0) {
      return res.status(404).json({ error: "Session not found" });
    }
    const report = await ensureSessionReportForUser(sessionResult.rows[0], req.user.id);
    return res.status(201).json({ report, session_id: req.params.id });
  } catch (error) {
    next(error);
  }
});

const copilotSchema = z.object({
  question: z.string().min(3).max(1000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(4000)
  })).max(12).optional()
});

function buildSessionCopilotContext(session) {
  const result = session.result_json || {};
  const extracted = result.extracted_data || {};
  const compliance = result.compliance || {};
  const decision = result.decision || {};
  const alerts = result.alerts || [];
  const references = result.standard_references || [];
  const suggestions = result.suggestions || [];

  const entities = Object.fromEntries(
    Object.entries(extracted)
      .filter(([, v]) => Array.isArray(v))
      .map(([k, v]) => [k, v.slice(0, 10)])
  );

  return {
    session_id: session.id,
    file_name: session.file_name,
    status: session.status,
    current_stage: session.current_stage,
    decision: {
      score: decision.score,
      risk_category: decision.risk_category,
      confidence: decision.confidence,
      fraud_score: decision.fraud_score,
      fraud_label: decision.fraud_label,
      explanation: decision.explanation,
      verification: decision.verification || {}
    },
    compliance: {
      summary: compliance.summary || {},
      violations: (compliance.violations || []).slice(0, 12)
    },
    alerts: alerts.slice(0, 12),
    extracted_entities: entities,
    standard_references: references.slice(0, 8),
    suggestions: suggestions.slice(0, 6)
  };
}

function enrichCopilotCitations(citations, context) {
  if (!Array.isArray(citations)) return [];
  const refs = context.standard_references || [];
  const refMap = new Map(refs.map((r) => [String(r.source_id || ""), r.source_url]).filter(([k, v]) => k && v));
  return citations.map((c) => {
    const id = String(c?.id || "");
    const hasLink = typeof c?.link === "string" && c.link.trim().length > 0;
    let link = hasLink ? c.link : "";
    if (!link && id && refMap.has(id)) link = refMap.get(id) || "";
    return {
      type: c?.type || "reference",
      id: c?.id || "",
      evidence: c?.evidence || "",
      link
    };
  });
}

router.post("/sessions/:id/copilot", requireAuth, async (req, res, next) => {
  try {
    const payload = copilotSchema.parse(req.body);
    const sessionResult = await pgPool.query(
      `SELECT id, file_name, status, current_stage, result_json
       FROM workflow_sessions
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (sessionResult.rowCount === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    const session = sessionResult.rows[0];
    const context = buildSessionCopilotContext(session);
    if (!context.decision?.score && !(context.compliance?.summary?.violations_count >= 0)) {
      return res.status(400).json({ error: "Session has no completed analysis context yet" });
    }

    const questionKey = payload.question.trim().toLowerCase();
    const cacheKey = `${req.user.id}:${session.id}:${session.status}:${questionKey}`;
    const cached = sessionCopilotCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < SESSION_COPILOT_CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    const copilot = await sessionCopilot({
      question: payload.question,
      history: payload.history || [],
      session_context: context
    });

    const responsePayload = {
      answer: copilot.answer || "",
      citations: enrichCopilotCitations(copilot.citations, context),
      follow_up: copilot.follow_up || ""
    };
    sessionCopilotCache.set(cacheKey, { ts: Date.now(), data: responsePayload });
    return res.json(responsePayload);
  } catch (error) {
    next(error);
  }
});

const simulationCreateSchema = z.object({
  name: z.string().min(3),
  regulator: z.string().min(2).default("RBI"),
  mode: z.enum(["single", "combined"]).default("single"),
  session_ids: z.array(z.string().uuid()).min(1)
});

router.post("/submission-simulations", requireAuth, async (req, res, next) => {
  try {
    const payload = simulationCreateSchema.parse(req.body);
    const sessionsResult = await pgPool.query(
      `SELECT id, file_name, status, result_json
       FROM workflow_sessions
       WHERE user_id = $1 AND id = ANY($2::uuid[])`,
      [req.user.id, payload.session_ids]
    );
    if (sessionsResult.rowCount === 0) {
      return res.status(404).json({ error: "No valid sessions found for simulation" });
    }

    const sessions = sessionsResult.rows;
    const reports = [];
    const submissionRows = [];
    const usableSessions = [];
    const skipped = [];
    for (const session of sessions) {
      try {
        if (session.status !== "completed") {
          skipped.push({ session_id: session.id, reason: `status_${session.status}` });
          continue;
        }
        const r = session.result_json || {};
        if (!r.document_id) {
          skipped.push({ session_id: session.id, reason: "missing_document_id" });
          continue;
        }

        const ensured = await ensureSessionReportForUser(session, req.user.id);
        reports.push(ensured);
        usableSessions.push(session);
        submissionRows.push({
          session_id: session.id,
          file_name: session.file_name,
          document_ref: r.document_id || ensured.document_ref,
          risk_category: r.decision?.risk_category || "NA",
          score: r.decision?.score ?? "NA",
          confidence: r.decision?.confidence ?? "NA",
          fraud_score: r.decision?.fraud_score ?? "NA",
          violations: r.compliance?.summary?.violations_count ?? 0
        });
      } catch (sessionError) {
        skipped.push({ session_id: session.id, reason: sessionError.message || "session_unusable" });
      }
    }

    if (!submissionRows.length) {
      return res.status(400).json({
        error: "No valid completed sessions available for staging",
        skipped
      });
    }

    const analysisSummary = summarizeSimulation(submissionRows, usableSessions);

    let finalReport = reports[0];
    if (payload.mode === "combined" || reports.length > 1) {
      const combined = await generateCombinedReport({
        package_name: payload.name,
        regulator: payload.regulator,
        submissions: submissionRows,
        analysis_summary: analysisSummary
      });
      const combinedInsert = await pgPool.query(
        `INSERT INTO reports_metadata (user_id, document_ref, report_path, report_type)
         VALUES ($1, $2, $3, $4)
         RETURNING id, document_ref, report_path, report_type, created_at`,
        [req.user.id, `SIM-${randomUUID().slice(0, 8)}`, combined.report_path, "PDF"]
      );
      finalReport = combinedInsert.rows[0];
    }

    const timeline = [
      {
        step: "STAGED",
        status: "completed",
        message: `Simulation staged for ${payload.regulator}. Readiness index: ${analysisSummary.readiness_index}/100.`,
        timestamp: new Date().toISOString()
      }
    ];

    const sim = await pgPool.query(
      `INSERT INTO regulatory_submission_simulations
       (id, user_id, name, regulator, mode, status, session_ids_json, report_ids_json, report_id, analysis_json, timeline_json)
       VALUES ($1, $2, $3, $4, $5, 'STAGED', $6::jsonb, $7::jsonb, $8, $9::jsonb, $10::jsonb)
       RETURNING *`,
      [
        randomUUID(),
        req.user.id,
        payload.name,
        payload.regulator,
        payload.mode,
        JSON.stringify(sessions.map((s) => s.id)),
        JSON.stringify(reports.map((r) => r.id)),
        finalReport.id,
        JSON.stringify(analysisSummary),
        JSON.stringify(timeline)
      ]
    );

    return res.status(201).json({ simulation: sim.rows[0], report: finalReport, skipped });
  } catch (error) {
    next(error);
  }
});

router.post("/submission-simulations/:id/run", requireAuth, async (req, res, next) => {
  try {
    const existing = await pgPool.query(
      `SELECT * FROM regulatory_submission_simulations WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: "Simulation not found" });
    }
    const sim = existing.rows[0];
    const ref = `RBI-SIM-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const timeline = [
      ...(sim.timeline_json || []),
      { step: "PACKAGED", status: "completed", message: "Submission package validated and sealed.", timestamp: new Date().toISOString() },
      { step: "QUEUED", status: "completed", message: "Queued for RBI gateway transmission (simulation).", timestamp: new Date().toISOString() },
      { step: "SUBMITTED", status: "completed", message: `Submitted to ${sim.regulator} simulation gateway.`, timestamp: new Date().toISOString() }
    ];

    const updated = await pgPool.query(
      `UPDATE regulatory_submission_simulations
       SET status = 'SUBMITTED', submission_ref = $3, timeline_json = $4::jsonb, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [req.params.id, req.user.id, ref, JSON.stringify(timeline)]
    );
    return res.json({ simulation: updated.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.get("/submission-simulations", requireAuth, async (req, res, next) => {
  try {
    const result = await pgPool.query(
      `SELECT s.*, s.report_id, s.analysis_json, r.report_path
       FROM regulatory_submission_simulations s
       LEFT JOIN reports_metadata r ON r.id = s.report_id
       WHERE s.user_id = $1
       ORDER BY s.updated_at DESC`,
      [req.user.id]
    );
    return res.json({ simulations: result.rows });
  } catch (error) {
    next(error);
  }
});

export default router;
