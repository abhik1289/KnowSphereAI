import { connection } from "next/server";
import { requireAuth } from "@/features/auth/server/require-auth";

export const instant = false;

async function page({ params }: { params: Promise<{ workspaceId: string }> }) {
  await connection();
  await requireAuth();
  const { workspaceId } = await params;

  return <div>This IS workspace Id page for {workspaceId}</div>;
}

export default page;
