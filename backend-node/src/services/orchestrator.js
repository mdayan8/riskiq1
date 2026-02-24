import fs from "fs";
import path from "path";
import crypto from "crypto";
import { pgPool } from "../db/postgres.js";
import { getMongoDb } from "../db/mongo.js";
import { generateReport, orchestrateAgents } from "./aiService.js";

export async function runWorkflow({ filePath, originalName, userId }) {
  return runWorkflowWithHooks({ filePath, originalName, userId });
}

export async function runWorkflowWithHooks({ filePath, originalName, userId, onStage = () => {} }) {
  const mongo = getMongoDb();
  await onStage({ stage: "INGESTION", status: "running", message: "File normalization and hash calculation started." });
  const fileBuffer = fs.readFileSync(filePath);
  const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  await onStage({ stage: "INGESTION", status: "completed", message: "File prepared for agent pipeline." });

  const [rulesResult, knowledgeResult, promptsResult] = await Promise.all([
    pgPool.query(
      `SELECT external_rule_id, regulator, description, field_name, requirement, severity
       FROM rules
       ORDER BY external_rule_id`
    ),
    pgPool.query(
      `SELECT source_id, framework, regulator, jurisdiction, title, issued_on, status, source_url, summary, tags, mandatory_checks
       FROM compliance_knowledge
       ORDER BY regulator, title`
    ),
    pgPool.query(
      `SELECT agent_name, objective, system_prompt, input_contract, output_contract
       FROM agent_prompts
       ORDER BY agent_name`
    )
  ]);

  await onStage({ stage: "DOCUMENT_AGENT", status: "running", message: "Extracting structured data via DeepSeek." });
  const run = await orchestrateAgents({
    file_path: filePath,
    file_name: originalName,
    file_b64: fileBuffer.toString("base64"),
    rules: rulesResult.rows.map((row) => ({
      id: row.external_rule_id,
      regulator: row.regulator,
      description: row.description,
      field: row.field_name,
      requirement: row.requirement,
      severity: row.severity
    })),
    knowledge_base: knowledgeResult.rows,
    agent_prompts: promptsResult.rows
  });
  await onStage({ stage: "DOCUMENT_AGENT", status: "completed", message: "Document entities extracted." });
  await onStage({ stage: "COMPLIANCE_AGENT", status: "running", message: "Applying GVR standards and validating clauses." });
  await onStage({ stage: "COMPLIANCE_AGENT", status: "completed", message: "Regulatory checks executed." });
  await onStage({ stage: "DECISION_AGENT", status: "running", message: "Computing two-layer verified risk score." });
  await onStage({ stage: "DECISION_AGENT", status: "completed", message: "Risk scoring completed." });
  await onStage({ stage: "MONITORING_AGENT", status: "running", message: "Evaluating anomaly and alert conditions." });
  await onStage({ stage: "MONITORING_AGENT", status: "completed", message: "Alerts and anomalies evaluated." });
  await onStage({ stage: "REPORTING_AGENT", status: "running", message: "Curating institutional report narrative." });
  await onStage({ stage: "REPORTING_AGENT", status: "completed", message: "Report narrative generated." });

  await onStage({ stage: "PERSISTENCE", status: "running", message: "Persisting outputs and report metadata." });
  const mongoDoc = await mongo.collection("documents").findOneAndUpdate(
    { user_id: userId, file_hash: fileHash },
    {
      $set: {
        user_id: userId,
        file_hash: fileHash,
        original_name: originalName,
        file_path: filePath,
        document_profile: run.document_profile || {},
        document_preview: run.document_preview || {},
        clause_line_map: run.clause_line_map || [],
        extracted_data: run.structured_data,
        ai_output: run.deepseek_output,
        agent_trace: run.agent_trace,
        updated_at: new Date()
      },
      $setOnInsert: { created_at: new Date() }
    },
    { upsert: true, returnDocument: "after", includeResultMetadata: false }
  );

  const documentRef = String(mongoDoc._id);

  // Keep one latest analytical state per document.
  await pgPool.query(`DELETE FROM alerts WHERE user_id = $1 AND document_ref = $2`, [userId, documentRef]);
  await pgPool.query(`DELETE FROM agent_runs WHERE user_id = $1 AND document_ref = $2`, [userId, documentRef]);
  await pgPool.query(`DELETE FROM compliance_results WHERE user_id = $1 AND document_ref = $2`, [userId, documentRef]);
  await pgPool.query(`DELETE FROM decision_scores WHERE user_id = $1 AND document_ref = $2`, [userId, documentRef]);

  const complianceInsert = await pgPool.query(
    `INSERT INTO compliance_results (user_id, document_ref, status, violations_json)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id`,
    [userId, documentRef, run.compliance.summary.status, JSON.stringify(run.compliance.violations)]
  );

  const decisionInsert = await pgPool.query(
    `INSERT INTO decision_scores (user_id, document_ref, score, fraud_score, fraud_label, confidence, risk_category, model_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      userId,
      documentRef,
      run.decision.score,
      run.decision.fraud_score,
      run.decision.fraud_label,
      run.decision.confidence,
      run.decision.risk_category,
      run.decision.model
    ]
  );

  for (const alert of run.alerts) {
    await pgPool.query(
      `INSERT INTO alerts (user_id, document_ref, severity, message, source)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, documentRef, alert.severity, alert.message, alert.source]
    );
  }

  for (const trace of run.agent_trace) {
    await pgPool.query(
      `INSERT INTO agent_runs (user_id, document_ref, agent_name, status, output_json)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [userId, documentRef, trace.agent, trace.status, JSON.stringify(trace.output)]
    );
  }

  const reportData = await generateReport({
    document_ref: documentRef,
    document_name: originalName,
    structured_data: run.structured_data,
    compliance: run.compliance,
    decision: run.decision,
    alerts: run.alerts,
    suggestions: run.suggestions || [],
    standard_references: run.standard_references || [],
    models_used: run.models_used || []
  });

  const absoluteReportPath = path.resolve(process.cwd(), "..", reportData.report_path);
  const reportExists = fs.existsSync(absoluteReportPath);

  const reportInsert = await pgPool.query(
    `INSERT INTO reports_metadata (user_id, document_ref, report_path, report_type)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [userId, documentRef, reportData.report_path, "PDF"]
  );
  await onStage({ stage: "PERSISTENCE", status: "completed", message: "Pipeline results saved." });

  return {
    document_id: documentRef,
    compliance_result_id: complianceInsert.rows[0].id,
    decision_score_id: decisionInsert.rows[0].id,
    report_id: reportInsert.rows[0].id,
    report_path: reportData.report_path,
    report_ready: reportExists,
    document_profile: run.document_profile || {},
    document_preview: run.document_preview || {},
    clause_line_map: run.clause_line_map || [],
    extracted_data: run.structured_data,
    compliance: run.compliance,
    decision: run.decision,
    alerts: run.alerts,
    reporting_summary: run.reporting_summary,
    suggestions: run.suggestions || [],
    standard_references: run.standard_references || [],
    models_used: run.models_used || []
  };
}
