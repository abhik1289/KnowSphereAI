import { connection } from "next/server";
import { WorkspaceChat } from "@/features/workspace/components/workspace-chat";
import { requireAuth } from "@/features/auth/server/require-auth";

export const instant = false;

async function page({ params }: { params: Promise<{ workspaceId: string }> }) {
  await connection();
  await requireAuth();
  const { workspaceId } = await params;

  return <WorkspaceChat workspaceId={workspaceId} />;
}

export default page;
