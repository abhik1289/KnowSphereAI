import { connection } from "next/server";
import { WorkspaceDashboard } from "@/features/workspace/components/workspace-dashboard";
import { requireAuth } from "@/features/auth/server/require-auth";

export const instant = false;

async function page() {
  await connection();
  await requireAuth();
  return <WorkspaceDashboard />;
}

export default page;
