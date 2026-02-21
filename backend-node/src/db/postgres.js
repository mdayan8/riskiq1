import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;
export const pgPool = new Pool({ connectionString: env.postgresUrl });

export async function ensurePgConnection() {
  await pgPool.query("SELECT 1");
}
