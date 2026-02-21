import crypto from "crypto";

const JOB_TTL_MS = 1000 * 60 * 30;
const jobs = new Map();

const STAGE_ORDER = [
  "INGESTION",
  "DOCUMENT_AGENT",
  "COMPLIANCE_AGENT",
  "DECISION_AGENT",
  "MONITORING_AGENT",
  "REPORTING_AGENT",
  "PERSISTENCE"
];

const STAGE_LABELS = {
  INGESTION: "Data Ingestion",
  DOCUMENT_AGENT: "Document Agent",
  COMPLIANCE_AGENT: "Compliance Agent",
  DECISION_AGENT: "Decision Agent",
  MONITORING_AGENT: "Monitoring Agent",
  REPORTING_AGENT: "Reporting Agent",
  PERSISTENCE: "Storage & Report"
};

function nowIso() {
  return new Date().toISOString();
}

function cleanupExpiredJobs() {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs.entries()) {
    if (new Date(job.updated_at).getTime() < cutoff) {
      jobs.delete(id);
    }
  }
}

export function createWorkflowJob({ userId, fileName }) {
  cleanupExpiredJobs();
  const jobId = crypto.randomUUID();
  const stages = STAGE_ORDER.map((key) => ({
    key,
    label: STAGE_LABELS[key],
    status: "pending",
    message: "",
    started_at: null,
    finished_at: null
  }));

  const job = {
    job_id: jobId,
    user_id: String(userId),
    file_name: fileName,
    status: "running",
    current_stage: "INGESTION",
    created_at: nowIso(),
    updated_at: nowIso(),
    stages,
    logs: [],
    result: null,
    error: null
  };

  jobs.set(jobId, job);
  return job;
}

function updateTimestamp(job) {
  job.updated_at = nowIso();
}

export function markStage(jobId, stageKey, status, message = "") {
  const job = jobs.get(jobId);
  if (!job) return;

  const stage = job.stages.find((s) => s.key === stageKey);
  if (!stage) return;

  if (status === "running") {
    stage.status = "running";
    stage.message = message;
    stage.started_at = stage.started_at || nowIso();
    stage.finished_at = null;
    job.current_stage = stageKey;
    job.logs.push({
      stage: stageKey,
      status,
      message,
      timestamp: nowIso()
    });
  }

  if (status === "completed") {
    stage.status = "completed";
    stage.message = message;
    stage.started_at = stage.started_at || nowIso();
    stage.finished_at = nowIso();

    const idx = STAGE_ORDER.indexOf(stageKey);
    const next = STAGE_ORDER[idx + 1];
    if (next) {
      job.current_stage = next;
    }
    job.logs.push({
      stage: stageKey,
      status,
      message,
      timestamp: nowIso()
    });
  }

  if (status === "failed") {
    stage.status = "failed";
    stage.message = message;
    stage.started_at = stage.started_at || nowIso();
    stage.finished_at = nowIso();
    job.current_stage = stageKey;
    job.status = "failed";
    job.error = message;
    job.logs.push({
      stage: stageKey,
      status,
      message,
      timestamp: nowIso()
    });
  }

  updateTimestamp(job);
}

export function completeWorkflowJob(jobId, result) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = "completed";
  job.current_stage = "DONE";
  job.result = result;
  job.logs.push({
    stage: "DONE",
    status: "completed",
    message: "Workflow completed successfully.",
    timestamp: nowIso()
  });
  updateTimestamp(job);
}

export function failWorkflowJob(jobId, message) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = "failed";
  job.error = message;
  job.logs.push({
    stage: job.current_stage || "UNKNOWN",
    status: "failed",
    message,
    timestamp: nowIso()
  });
  updateTimestamp(job);
}

export function getWorkflowJob(jobId, userId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  if (String(job.user_id) !== String(userId)) return null;
  return job;
}
