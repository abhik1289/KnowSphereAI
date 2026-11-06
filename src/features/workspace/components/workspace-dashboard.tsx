"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FolderOpen, LoaderCircle, Plus, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceCreateSchema, type WorkspaceCreate } from "../shared/schemas";
import {
  useCreateWorkspace,
  useDeleteWorkspace,
  useWorkspaces,
} from "../client/hooks";
import { WorkspaceQueryProvider } from "./query-provider";
import { WorkspaceCard } from "./workspace-card";

export function WorkspaceDashboard() {
  return (
    <WorkspaceQueryProvider>
      <WorkspaceDashboardContent />
    </WorkspaceQueryProvider>
  );
}

function WorkspaceDashboardContent() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const workspaces = useWorkspaces(search, page);
  const createWorkspace = useCreateWorkspace();
  const deleteWorkspace = useDeleteWorkspace();
  const form = useForm<WorkspaceCreate>({
    resolver: zodResolver(WorkspaceCreateSchema),
    defaultValues: { name: "", description: "" },
  });

  async function submitWorkspace(values: WorkspaceCreate) {
    try {
      await createWorkspace.mutateAsync(values);
      form.reset();
      setShowCreate(false);
    } catch {
      // Mutation errors are rendered below.
    }
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-73px)] w-full max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
      <div className="flex flex-col justify-between gap-6 border-b pb-8 sm:flex-row sm:items-end">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Sparkles className="size-4" aria-hidden="true" />
            Your knowledge, organized
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Workspaces
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Keep your documents and conversations together in one focused space.
          </p>
        </div>
        <Button
          className="h-11 gap-2 rounded-xl px-5"
          onClick={() => setShowCreate(true)}>
          <Plus aria-hidden="true" className="size-4" />
          New workspace
        </Button>
      </div>

      <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">All workspaces</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {workspaces.data
              ? `${workspaces.data.length} shown`
              : "Your private spaces"}
          </p>
        </div>
        <label className="flex h-10 w-full items-center gap-2 rounded-xl border bg-background px-3 text-muted-foreground sm:max-w-sm">
          <Search aria-hidden="true" className="size-4 shrink-0" />
          <input
            aria-label="Search workspaces"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search workspaces"
            value={search}
          />
        </label>
      </div>

      {createWorkspace.isError && (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {createWorkspace.error.message}
        </p>
      )}
      {deleteWorkspace.isError && (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {deleteWorkspace.error.message}
        </p>
      )}
      {workspaces.isError && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {workspaces.error.message}
        </p>
      )}

      {workspaces.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              className="h-48 animate-pulse rounded-2xl border bg-muted/40"
              key={index}
            />
          ))}
        </div>
      ) : workspaces.data?.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {workspaces.data.map((workspace) => (
            <WorkspaceCard
              key={workspace.id}
              onDelete={() => {
                if (
                  window.confirm(
                    `Delete "${workspace.name}" and its documents and conversations?`,
                  )
                ) {
                  deleteWorkspace.mutate(workspace.id);
                }
              }}
              workspace={workspace}
            />
          ))}
        </div>
      ) : (
        <section className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 px-6 text-center">
          <div className="mb-4 grid size-12 place-items-center rounded-2xl border bg-background">
            <FolderOpen
              aria-hidden="true"
              className="size-5 text-muted-foreground"
            />
          </div>
          <h3 className="font-semibold">
            {search
              ? "No matching workspaces"
              : "Your first workspace starts here"}
          </h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            {search
              ? "Try another search, or clear the search field."
              : "Create a workspace to bring your documents and related chats together."}
          </p>
          {!search && (
            <Button
              className="mt-5 gap-2 rounded-xl"
              onClick={() => setShowCreate(true)}>
              <Plus aria-hidden="true" className="size-4" />
              Create workspace
            </Button>
          )}
        </section>
      )}

      <div className="flex items-center justify-between pt-6">
        <p className="text-sm text-muted-foreground">Page {page}</p>
        <div className="flex gap-2">
          <Button
            disabled={page === 1 || workspaces.isPending}
            onClick={() => setPage((value) => value - 1)}
            variant="outline">
            Previous
          </Button>
          <Button
            disabled={
              (workspaces.data?.length ?? 0) < 12 || workspaces.isPending
            }
            onClick={() => setPage((value) => value + 1)}
            variant="outline">
            Next
          </Button>
        </div>
      </div>

      {showCreate && (
        <dialog
          className="fixed inset-0 z-50 m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/40"
          onClose={() => setShowCreate(false)}
          open>
          <form
            className="space-y-5 p-6 sm:p-8"
            onSubmit={form.handleSubmit(submitWorkspace)}>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                New space
              </p>
              <h2 className="mt-1 text-2xl font-semibold">
                Create a workspace
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                A home for a project, its files, and its conversations.
              </p>
            </div>
            <label className="block space-y-2 text-sm font-medium">
              Workspace name
              <input
                autoFocus
                className="h-11 w-full rounded-xl border bg-background px-3 font-normal outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="e.g. Product research"
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <span className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </span>
              )}
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Description{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
              <textarea
                className="min-h-24 w-full resize-y rounded-xl border bg-background px-3 py-2 font-normal outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="What are you working on?"
                {...form.register("description")}
              />
              {form.formState.errors.description && (
                <span className="text-xs text-destructive">
                  {form.formState.errors.description.message}
                </span>
              )}
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                onClick={() => setShowCreate(false)}
                type="button"
                variant="outline">
                Cancel
              </Button>
              <Button disabled={createWorkspace.isPending} type="submit">
                {createWorkspace.isPending && (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                )}
                Create workspace
              </Button>
            </div>
          </form>
        </dialog>
      )}
    </main>
  );
}
