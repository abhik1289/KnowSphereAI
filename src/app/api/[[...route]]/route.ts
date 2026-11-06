import { Hono } from "hono";
import { handle } from "@hono/vercel";
import { workspaceApi } from "@/features/workspace/server/api";

const app = new Hono().basePath("/api");
app.route("/user", workspaceApi);

app.get("/hello", (c) => {
  return c.json({
    message: "Hello Next.js!",
  });
});

export const GET = handle(app);

export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);
