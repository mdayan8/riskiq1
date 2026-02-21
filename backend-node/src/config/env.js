import dotenv from "dotenv";

dotenv.config();

const required = [
  "PORT",
  "JWT_SECRET",
  "PYTHON_SERVICE_URL",
  "POSTGRES_URL",
  "MONGO_URL",
  "MONGO_DB",
  "UPLOAD_DIR"
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
  uploadDir: process.env.UPLOAD_DIR
};
