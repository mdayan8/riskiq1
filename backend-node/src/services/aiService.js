import axios from "axios";
import { env } from "../config/env.js";

const client = axios.create({
  baseURL: env.pythonServiceUrl,
  timeout: 120000
});

export async function analyzeDocument(payload) {
  const { data } = await client.post("/analyze-document", payload);
  return data;
}

export async function orchestrateAgents(payload) {
  const { data } = await client.post("/orchestrate-agents", payload);
  return data;
}

export async function orchestrateAgentsUpload(payload) {
  const form = new FormData();
  const blob = new Blob([payload.fileBuffer], { type: "application/octet-stream" });
  form.append("file", blob, payload.file_name || "document.bin");
  form.append("file_name", payload.file_name || "document.bin");
  form.append("file_path", payload.file_path || "");
  form.append("rules", JSON.stringify(payload.rules || []));
  form.append("knowledge_base", JSON.stringify(payload.knowledge_base || []));
  form.append("agent_prompts", JSON.stringify(payload.agent_prompts || []));

  const response = await fetch(`${env.pythonServiceUrl}/orchestrate-agents-upload`, {
    method: "POST",
    body: form
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(typeof body === "string" ? body : JSON.stringify(body));
  }
  return body;
}

export async function validateCompliance(payload) {
  const { data } = await client.post("/validate-compliance", payload);
  return data;
}

export async function decisionScore(payload) {
  const { data } = await client.post("/decision-score", payload);
  return data;
}

export async function generateReport(payload) {
  const { data } = await client.post("/generate-report", payload);
  return data;
}

export async function generateCombinedReport(payload) {
  const { data } = await client.post("/generate-combined-report", payload);
  return data;
}

export async function sessionCopilot(payload) {
  const { data } = await client.post("/session-copilot", payload);
  return data;
}

export async function rewriteClause(payload) {
  const { data } = await client.post("/rewrite-clause", payload);
  return data;
}

export async function aiHealth() {
  const { data } = await client.get("/health");
  return data;
}
