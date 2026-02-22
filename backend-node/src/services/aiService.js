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
