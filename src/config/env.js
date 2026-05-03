/**
 * Environment configuration with validation.
 * Ensures all required environment variables are present at startup.
 */
require("dotenv").config();

const REQUIRED_VARS = ["MONGO_URI", "JWT_SECRET"];

function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error("FATAL: Missing required environment variables:", missing.join(", "));
    process.exit(1);
  }
}

validateEnv();

module.exports = {
  PORT: Number(process.env.PORT) || 5000,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  SESSION_HOURS: Number(process.env.SESSION_HOURS) || 12,
  FRONTEND_BASE_URL: process.env.FRONTEND_BASE_URL || "",
  NODE_ENV: process.env.NODE_ENV || "production"
};
