import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { pgPool } from "../db/postgres.js";

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["Admin", "Analyst"]).default("Analyst")
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

router.post("/register", async (req, res, next) => {
  try {
    const payload = registerSchema.parse(req.body);
    const hash = await bcrypt.hash(payload.password, 10);

    const existing = await pgPool.query("SELECT id FROM users WHERE email = $1", [payload.email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: "Email already exists" });
    }

    const result = await pgPool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [payload.name, payload.email, hash, payload.role]
    );

    return res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const result = await pgPool.query("SELECT id, email, password_hash, role, name FROM users WHERE email = $1", [
      payload.email
    ]);

    if (result.rowCount === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const ok = await bcrypt.compare(payload.password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id, role: user.role, email: user.email }, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn
    });

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
