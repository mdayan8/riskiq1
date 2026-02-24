import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { pgPool } from "./postgres.js";
import { env } from "../config/env.js";

function loadJson(relativePath) {
  const fullPath = path.resolve(process.cwd(), "..", relativePath);
  return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
}

export async function ensurePlatformSchema() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS compliance_knowledge (
      id BIGSERIAL PRIMARY KEY,
      source_id TEXT NOT NULL UNIQUE,
      framework TEXT NOT NULL,
      regulator TEXT NOT NULL,
      jurisdiction TEXT NOT NULL,
      title TEXT NOT NULL,
      issued_on DATE,
      status TEXT NOT NULL,
      source_url TEXT NOT NULL,
      summary TEXT NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}',
      mandatory_checks TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS agent_prompts (
      id BIGSERIAL PRIMARY KEY,
      agent_name TEXT NOT NULL UNIQUE,
      objective TEXT NOT NULL,
      system_prompt TEXT NOT NULL,
      input_contract JSONB NOT NULL,
      output_contract JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_ref TEXT NOT NULL,
      agent_name TEXT NOT NULL,
      status TEXT NOT NULL,
      output_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS workflow_sessions (
      id UUID PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      status TEXT NOT NULL,
      current_stage TEXT,
      stages_json JSONB NOT NULL,
      result_json JSONB,
      error_text TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS regulatory_submission_simulations (
      id UUID PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      regulator TEXT NOT NULL DEFAULT 'RBI',
      mode TEXT NOT NULL CHECK (mode IN ('single', 'combined')),
      status TEXT NOT NULL CHECK (status IN ('STAGED', 'SUBMITTING', 'SUBMITTED', 'FAILED')),
      session_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      report_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      report_id BIGINT REFERENCES reports_metadata(id) ON DELETE SET NULL,
      submission_ref TEXT,
      analysis_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      timeline_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pgPool.query(`
    ALTER TABLE decision_scores
    ADD COLUMN IF NOT EXISTS fraud_score NUMERIC(6,4),
    ADD COLUMN IF NOT EXISTS fraud_label TEXT;
  `);

  await pgPool.query(`
    ALTER TABLE regulatory_submission_simulations
    ADD COLUMN IF NOT EXISTS analysis_json JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);
}

export async function syncReferenceData() {
  const rules = loadJson("rules/rules.json");
  const knowledge = loadJson("rules/compliance_datastore.json");
  const prompts = loadJson("rules/agent_prompts.json");

  for (const rule of rules) {
    await pgPool.query(
      `INSERT INTO rules (external_rule_id, regulator, description, field_name, requirement, severity)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (external_rule_id)
       DO UPDATE SET
         regulator = EXCLUDED.regulator,
         description = EXCLUDED.description,
         field_name = EXCLUDED.field_name,
         requirement = EXCLUDED.requirement,
         severity = EXCLUDED.severity`,
      [rule.id, rule.regulator, rule.description, rule.field, rule.requirement, rule.severity]
    );
  }

  for (const item of knowledge) {
    await pgPool.query(
      `INSERT INTO compliance_knowledge (
         source_id, framework, regulator, jurisdiction, title, issued_on, status,
         source_url, summary, tags, mandatory_checks
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], $11::text[])
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

  for (const prompt of prompts) {
    await pgPool.query(
      `INSERT INTO agent_prompts (agent_name, objective, system_prompt, input_contract, output_contract)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
       ON CONFLICT (agent_name)
       DO UPDATE SET
         objective = EXCLUDED.objective,
         system_prompt = EXCLUDED.system_prompt,
         input_contract = EXCLUDED.input_contract,
         output_contract = EXCLUDED.output_contract,
         updated_at = NOW()`,
      [
        prompt.agent_name,
        prompt.objective,
        prompt.system_prompt,
        JSON.stringify(prompt.input_contract),
        JSON.stringify(prompt.output_contract)
      ]
    );
  }
}

export async function ensureFixedAdminUser() {
  const email = env.adminEmail;
  const password = env.adminPassword;
  const name = env.adminName;
  const role = "Admin";

  const existing = await pgPool.query(
    "SELECT id, password_hash FROM users WHERE email = $1 LIMIT 1",
    [email]
  );

  if (existing.rowCount === 0) {
    const hash = await bcrypt.hash(password, 12);
    await pgPool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)`,
      [name, email, hash, role]
    );
    return;
  }

  const current = existing.rows[0];
  const samePassword = await bcrypt.compare(password, current.password_hash);
  if (!samePassword) {
    const hash = await bcrypt.hash(password, 12);
    await pgPool.query(
      `UPDATE users
       SET password_hash = $2, name = $3, role = $4
       WHERE id = $1`,
      [current.id, hash, name, role]
    );
  }
}
