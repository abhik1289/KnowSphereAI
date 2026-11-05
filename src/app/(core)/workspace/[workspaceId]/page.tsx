import React from "react";

async function page({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;

  return <div>This IS workspace Id page for {workspaceId}</div>;
}

export default page;
