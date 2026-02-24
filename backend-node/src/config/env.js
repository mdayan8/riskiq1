import dotenv from "dotenv";

dotenv.config();

const required = [
  "PORT",
  "JWT_SECRET",
  "PYTHON_SERVICE_URL",
  "POSTGRES_URL",
  "MONGO_URL",
  "MONGO_DB",
  "UPLOAD_DIR",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD"
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT),
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  pythonServiceUrl: process.env.PYTHON_SERVICE_URL,
  postgresUrl: process.env.POSTGRES_URL,
  mongoUrl: process.env.MONGO_URL,
  mongoDb: process.env.MONGO_DB,
  uploadDir: process.env.UPLOAD_DIR,
  adminEmail: process.env.ADMIN_EMAIL.toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD,
  adminName: process.env.ADMIN_NAME || "RiskIQ Admin",
  disablePublicRegistration: String(process.env.DISABLE_PUBLIC_REGISTRATION || "true").toLowerCase() === "true",
  corsOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
};

if (env.adminPassword.length < 12) {
  throw new Error("ADMIN_PASSWORD must be at least 12 characters");
}
