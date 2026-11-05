import { connection } from "next/server";
import { requireAuth } from "@/features/auth/server/require-auth";

export const instant = false;

async function page() {
  await connection();
  await requireAuth();
  return <div>This is Workspace</div>;
}

export default page;
