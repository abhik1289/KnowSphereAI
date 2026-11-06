import { z } from "zod";

const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
});

const authEnvSchema = databaseEnvSchema.extend({
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_GOOGLE_ID: z.string().min(1, "AUTH_GOOGLE_ID is required"),
  AUTH_GOOGLE_SECRET: z.string().min(1, "AUTH_GOOGLE_SECRET is required"),
  AUTH_TRUST_HOST: z.literal("true").transform(() => true),
});

export function getDatabaseEnv() {
  return databaseEnvSchema.parse(process.env);
}

export function getAuthEnv() {
  return authEnvSchema.parse(process.env);
}

const imageKitEnvSchema = z.object({
  IMAGEKIT_PRIVATE_KEY: z.string().min(1, "IMAGEKIT_PRIVATE_KEY is required"),
  IMAGEKIT_URL_ENDPOINT: z.string().url("IMAGEKIT_URL_ENDPOINT must be a URL"),
});

export function getImageKitEnv() {
  return imageKitEnvSchema.parse(process.env);
}
