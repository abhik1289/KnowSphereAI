import {
  ArrowUpRight,
  FolderOpen,
  MessageSquareText,
  Trash2,
} from "lucide-react";
import { useUpdateWorkspace } from "../client/hooks";
import Link from "next/link";

export function WorkspaceCard({
  workspace,
  onDelete,
}: {
  workspace: {
    id: string;
    name: string;
    description: string | null;
    documentCount: number;
    conversationCount: number;
    updatedAt: string;
  };
  onDelete: () => void;
}) {
  const updateWorkspace = useUpdateWorkspace(workspace.id);

  function rename() {
    const name = window.prompt("Rename workspace", workspace.name)?.trim();
    if (name && name !== workspace.name) {
      updateWorkspace.mutate({ name });
    }
  }

  return (
    <article className="group relative flex min-h-48 flex-col rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg hover:shadow-black/5">
      <div className="mb-5 flex items-start justify-between">
        <div className="grid size-10 place-items-center rounded-xl bg-muted">
          <FolderOpen aria-hidden="true" className="size-5" />
        </div>
        <div className="flex gap-1">
          <button
            aria-label={`Rename ${workspace.name}`}
            className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={rename}
            type="button">
            <span aria-hidden="true" className="text-base">
              •••
            </span>
          </button>
          <button
            aria-label={`Delete ${workspace.name}`}
            className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
            type="button">
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
      <Link
        className="flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={`/workspace/${workspace.id}`}>
        <span className="flex items-center gap-2 font-semibold">
          {workspace.name}
          <ArrowUpRight
            aria-hidden="true"
            className="size-4 opacity-0 transition group-hover:opacity-70"
          />
        </span>
        <span className="mt-2 line-clamp-2 block min-h-10 text-sm leading-5 text-muted-foreground">
          {workspace.description ||
            "A private space for your documents and chats."}
        </span>
      </Link>
      <div className="mt-5 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <FolderOpen aria-hidden="true" className="size-3.5" />
          {workspace.documentCount}{" "}
          {workspace.documentCount === 1 ? "file" : "files"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MessageSquareText aria-hidden="true" className="size-3.5" />
          {workspace.conversationCount} chats
        </span>
        <time dateTime={workspace.updatedAt}>
          {new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
          }).format(new Date(workspace.updatedAt))}
        </time>
      </div>
      {updateWorkspace.isError && (
        <p className="mt-2 text-xs text-destructive">
          {updateWorkspace.error.message}
        </p>
      )}
    </article>
  );
}
