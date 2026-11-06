"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowUp,
  FileText,
  FolderOpen,
  LoaderCircle,
  Menu,
  MessageSquarePlus,
  MoreHorizontal,
  Paperclip,
  Search,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import type { ConversationDto, MessageDto } from "../shared/schemas";
import {
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useDeleteDocument,
  useDocuments,
  useMessages,
  useRenameConversation,
  useSendMessage,
  useUpdateDocument,
  useUpdateWorkspace,
  useUploadDocument,
  useWorkspace,
} from "../client/hooks";
import { WorkspaceQueryProvider } from "./query-provider";

export function WorkspaceChat({ workspaceId }: { workspaceId: string }) {
  return (
    <WorkspaceQueryProvider>
      <WorkspaceChatContent workspaceId={workspaceId} />
    </WorkspaceQueryProvider>
  );
}

function WorkspaceChatContent({ workspaceId }: { workspaceId: string }) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    null,
  );
  const [isNewChat, setIsNewChat] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [streamText, setStreamText] = useState("");
  const [streamMessageId, setStreamMessageId] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const activeUpload = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const workspace = useWorkspace(workspaceId);
  const queryClient = useQueryClient();
  const documents = useDocuments(workspaceId);
  const conversations = useConversations(workspaceId, conversationSearch);
  const activeConversationId =
    selectedConversationId ??
    (!isNewChat ? conversations.data?.[0]?.id ?? null : null);
  const messages = useMessages(activeConversationId);
  const createConversation = useCreateConversation(workspaceId);
  const renameConversation = useRenameConversation(workspaceId);
  const deleteConversation = useDeleteConversation(workspaceId);
  const updateWorkspace = useUpdateWorkspace(workspaceId);
  const updateDocument = useUpdateDocument(workspaceId);
  const deleteDocument = useDeleteDocument(workspaceId);
  const uploadDocument = useUploadDocument(workspaceId);
  const sendMessage = useSendMessage();

  const activeConversation =
    conversations.data?.find(
      (conversation) => conversation.id === activeConversationId,
    ) ?? null;
  const messageList = messages.data ?? [];
  const isGenerating = sendMessage.isPending;

  async function startNewChat() {
    setSidebarOpen(false);
    setStreamError(null);
    setIsNewChat(true);
    setSelectedConversationId(null);
    setDraft("");
    try {
      const conversation = await createConversation.mutateAsync();
      setSelectedConversationId(conversation.id);
      setIsNewChat(false);
      composer.current?.focus();
    } catch (error) {
      setIsNewChat(false);
      setStreamError(error instanceof Error ? error.message : "Could not create chat.");
    }
  }

  async function submitMessage(event?: FormEvent, overrideText?: string) {
    event?.preventDefault();
    const content = (overrideText ?? draft).trim();
    if (!content || isGenerating || uploadProgress !== null) return;
    setDraft("");
    setStreamError(null);
    setStreamText("");
    setStreamMessageId(null);

    let conversationId = activeConversationId;
    if (!conversationId) {
      try {
        const conversation = await createConversation.mutateAsync();
        conversationId = conversation.id;
        setSelectedConversationId(conversationId);
        setIsNewChat(false);
      } catch (error) {
        setDraft(content);
        setStreamError(
          error instanceof Error ? error.message : "Could not create a conversation.",
        );
        return;
      }
    }

    const requestId = crypto.randomUUID();
    const userMessage: MessageDto = {
      id: requestId,
      conversationId,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    queryClient.setQueryData<MessageDto[]>(
      ["messages", conversationId],
      (current) => [...(current ?? []), userMessage],
    );
    abortController.current = new AbortController();
    try {
      await sendMessage.mutateAsync({
        conversationId,
        content,
        requestId,
        signal: abortController.current.signal,
        onStart: (messageId) => setStreamMessageId(messageId),
        onDelta: (delta) => setStreamText((current) => current + delta),
        onComplete: () => {
          setStreamError(null);
        },
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setStreamError(error instanceof Error ? error.message : "The response failed.");
      }
    } finally {
      abortController.current = null;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["messages", conversationId] }),
        queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] }),
      ]);
      setStreamMessageId(null);
      setStreamText("");
    }
  }

  function stopGeneration() {
    abortController.current?.abort();
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  }

  async function handleUpload(files: FileList | File[]) {
    const selectedFiles = Array.from(files);
    setUploadError(null);
    for (const file of selectedFiles) {
      const controller = new AbortController();
      activeUpload.current = controller;
      setUploadStatus(`Uploading ${file.name}`);
      setUploadProgress(0);
      try {
        await uploadDocument.mutateAsync({
          file,
          signal: controller.signal,
          onProgress: setUploadProgress,
        });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setUploadError(error instanceof Error ? error.message : "Upload failed.");
        }
        break;
      } finally {
        activeUpload.current = null;
        setUploadProgress(null);
        setUploadStatus("");
      }
    }
  }

  if (workspace.isPending) {
    return (
      <div className="grid min-h-[calc(100vh-73px)] place-items-center">
        <LoaderCircle aria-label="Loading workspace" className="size-6 animate-spin" />
      </div>
    );
  }
  if (workspace.isError || !workspace.data) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-xl font-semibold">Workspace unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {workspace.error?.message ?? "The workspace could not be found."}
        </p>
        <Link
          className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/85"
          href="/workspace"
        >
          Back to workspaces
        </Link>
      </div>
    );
  }

  return (
    <main className="relative flex h-[calc(100dvh-73px)] min-h-[520px] overflow-hidden bg-background">
      {sidebarOpen && (
        <button
          aria-label="Close sidebar"
          className="absolute inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
          type="button"
        />
      )}
      <aside
        className={`absolute inset-y-0 left-0 z-40 flex w-[min(88vw,320px)] flex-col border-r bg-muted/30 transition-transform md:relative md:z-0 md:w-[290px] md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b px-4 py-4">
          <Link
            className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/workspace"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <FolderOpen aria-hidden="true" className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {workspace.data.name}
              </span>
              <span className="block text-xs text-muted-foreground">Workspace</span>
            </span>
          </Link>
          <button
            aria-label="Close sidebar"
            className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
            onClick={() => setSidebarOpen(false)}
            type="button"
          >
            <X className="size-4" />
          </button>
          <button
            aria-label="Workspace actions"
            className="hidden size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted md:grid"
            onClick={() => {
              const nextName = window.prompt("Rename workspace", workspace.data.name)?.trim();
              if (nextName && nextName !== workspace.data.name) {
                updateWorkspace.mutate({ name: nextName });
              }
            }}
            type="button"
          >
            <MoreHorizontal aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="p-3">
          <button
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/85"
            disabled={createConversation.isPending}
            onClick={() => void startNewChat()}
            type="button"
          >
            <MessageSquarePlus aria-hidden="true" className="size-4" />
            New chat
          </button>
          {createConversation.isError && (
            <p className="mt-2 text-xs text-destructive">
              {createConversation.error.message}
            </p>
          )}
        </div>

        <div className="px-3 pb-2">
          <label className="flex h-9 items-center gap-2 rounded-lg border bg-background px-2.5 text-muted-foreground">
            <Search aria-hidden="true" className="size-3.5" />
            <input
              aria-label="Search chat history"
              className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
              onChange={(event) => setConversationSearch(event.target.value)}
              placeholder="Search chats"
              value={conversationSearch}
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <p className="px-2 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Recent chats
          </p>
          {conversations.isPending ? (
            <div className="space-y-2 px-2">
              {[1, 2, 3].map((item) => (
                <div className="h-9 animate-pulse rounded-lg bg-muted" key={item} />
              ))}
            </div>
          ) : conversations.data?.length ? (
            <div className="space-y-0.5">
              {conversations.data.map((conversation) => (
                <ConversationRow
                  active={activeConversationId === conversation.id}
                  conversation={conversation}
                  key={conversation.id}
                  onDelete={() => {
                    if (window.confirm(`Delete “${conversation.title}”?`)) {
                      deleteConversation.mutate(conversation.id, {
                        onSuccess: () => {
                          if (activeConversationId === conversation.id) {
                            setSelectedConversationId(null);
                            setIsNewChat(false);
                          }
                        },
                      });
                    }
                  }}
                  onRename={() => {
                    const title = window.prompt("Rename chat", conversation.title)?.trim();
                    if (title && title !== conversation.title) {
                      renameConversation.mutate({ conversationId: conversation.id, title });
                    }
                  }}
                  onSelect={() => {
                    setIsNewChat(false);
                    setSelectedConversationId(conversation.id);
                    setSidebarOpen(false);
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="px-2 py-4 text-xs leading-5 text-muted-foreground">
              {conversationSearch ? "No chats match your search." : "Your conversations will appear here."}
            </p>
          )}
          {conversations.isError && (
            <p className="px-2 py-2 text-xs text-destructive">
              {conversations.error.message}
            </p>
          )}
          {renameConversation.isError && (
            <p className="px-2 py-2 text-xs text-destructive">
              {renameConversation.error.message}
            </p>
          )}
          {deleteConversation.isError && (
            <p className="px-2 py-2 text-xs text-destructive">
              {deleteConversation.error.message}
            </p>
          )}

          <div className="mt-6 border-t pt-4">
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Documents
              </p>
              <button
                aria-label="Upload documents"
                className="grid size-7 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={() => fileInput.current?.click()}
                type="button"
              >
                <Paperclip aria-hidden="true" className="size-3.5" />
              </button>
              <input
                accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.md"
                className="sr-only"
                multiple
                onChange={(event) => {
                  if (event.target.files) void handleUpload(event.target.files);
                  event.target.value = "";
                }}
                ref={fileInput}
                type="file"
              />
            </div>
            <div
              className="rounded-xl border border-dashed px-3 py-3 text-center text-xs text-muted-foreground transition hover:border-foreground/30 hover:bg-muted/30"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void handleUpload(event.dataTransfer.files);
              }}
            >
              Drop files here or{" "}
              <button
                className="font-medium text-foreground underline-offset-4 hover:underline"
                onClick={() => fileInput.current?.click()}
                type="button"
              >
                browse
              </button>
              <p className="mt-1 text-[10px]">PDF, Office, TXT, CSV, MD · up to 25 MB</p>
            </div>
            {uploadProgress !== null && (
              <div aria-live="polite" className="mt-2 rounded-lg bg-muted px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate">{uploadStatus}</span>
                  <button
                    aria-label="Cancel upload"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => activeUpload.current?.abort()}
                    type="button"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
            {uploadError && (
              <p className="mt-2 text-xs text-destructive">{uploadError}</p>
            )}
            {documents.isPending ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">Loading files…</p>
            ) : documents.isError ? (
              <p className="px-2 py-3 text-xs text-destructive">
                {documents.error.message}
              </p>
            ) : documents.data?.length ? (
              <div className="mt-2 space-y-0.5">
                {documents.data.map((document) => (
                  <div
                    className="group flex items-center gap-2 rounded-lg px-2 py-2 text-xs transition hover:bg-muted"
                    key={document.id}
                  >
                    <FileText aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                    <a
                      className="min-w-0 flex-1 truncate outline-none focus-visible:underline"
                      href={`/api/user/workspaces/${workspaceId}/documents/${document.id}/download`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {document.originalName}
                    </a>
                    <button
                      aria-label={`Rename ${document.originalName}`}
                      className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground opacity-100 hover:bg-background hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
                      onClick={() => {
                        const originalName = window
                          .prompt("Rename document", document.originalName)
                          ?.trim();
                        if (originalName && originalName !== document.originalName) {
                          updateDocument.mutate({ documentId: document.id, originalName });
                        }
                      }}
                      type="button"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </button>
                    <button
                      aria-label={`Delete ${document.originalName}`}
                      className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground opacity-100 hover:bg-background hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                      onClick={() => {
                        if (window.confirm(`Delete "${document.originalName}"?`)) {
                          deleteDocument.mutate(document.id);
                        }
                      }}
                      type="button"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                Your workspace files will show up here.
              </p>
            )}
            {deleteDocument.isError && (
              <p className="px-2 py-2 text-xs text-destructive">
                {deleteDocument.error.message}
              </p>
            )}
            {updateDocument.isError && (
              <p className="px-2 py-2 text-xs text-destructive">
                {updateDocument.error.message}
              </p>
            )}
          </div>
        </div>

        <div className="border-t px-4 py-3 text-[11px] leading-5 text-muted-foreground">
          Responses are demo-only and aren&apos;t based on your files.
        </div>
      </aside>

      <section
        className="flex min-w-0 flex-1 flex-col"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          if (event.dataTransfer.files.length) {
            event.preventDefault();
            void handleUpload(event.dataTransfer.files);
          }
        }}
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              aria-label="Open workspace sidebar"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
              onClick={() => setSidebarOpen(true)}
              type="button"
            >
              <Menu aria-hidden="true" className="size-4" />
            </button>
            <span className="truncate text-sm font-medium">
              {activeConversation?.title ?? (isNewChat ? "New chat" : workspace.data.name)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">{workspace.data.documentCount} documents</span>
            {updateWorkspace.isError && (
              <span className="text-destructive">{updateWorkspace.error.message}</span>
            )}
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          {activeConversationId || isNewChat ? (
            <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4">
              <div className="min-h-0 flex-1 overflow-y-auto py-6 sm:py-10">
                {messages.isPending && activeConversation && (
                  <div className="space-y-4">
                    {[1, 2].map((item) => (
                      <div className="h-20 animate-pulse rounded-2xl bg-muted/50" key={item} />
                    ))}
                  </div>
                )}
                {!messageList.length && !streamText && (
                  <div className="flex min-h-full flex-col items-center justify-center pb-8 text-center">
                    <div className="mb-5 grid size-14 place-items-center rounded-2xl border bg-card shadow-sm">
                      <MessageSquarePlus aria-hidden="true" className="size-6" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                      What would you like to explore?
                    </h1>
                    <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                      Ask a question or start with a prompt. Demo replies are not grounded in your uploaded files.
                    </p>
                    <div className="mt-7 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                      {[
                        "Summarize my uploaded documents",
                        "Explain the key concepts",
                        "Find important information",
                        "Compare uploaded documents",
                      ].map((prompt) => (
                        <button
                          className="rounded-xl border bg-card px-4 py-3 text-left text-sm transition hover:border-foreground/25 hover:bg-muted/50"
                          key={prompt}
                          onClick={() => void submitMessage(undefined, prompt)}
                          type="button"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-6">
                  {messageList.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  {streamMessageId && (
                    <div className="flex gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-xs font-semibold text-primary-foreground">
                        K
                      </span>
                      <div className="min-w-0 flex-1 pt-1 text-sm leading-7">
                        {streamText ? (
                          <MarkdownContent content={streamText} />
                        ) : (
                          <LoaderCircle className="mt-1 size-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  )}
                  {isGenerating && !streamMessageId && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                      Preparing a demo response…
                    </div>
                  )}
                  <div aria-live="polite">
                    {streamError && (
                      <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                        {streamError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <form className="shrink-0 pb-4 sm:pb-6" onSubmit={(event) => void submitMessage(event)}>
                <div className="rounded-2xl border bg-card p-2 shadow-sm transition focus-within:border-foreground/25 focus-within:ring-2 focus-within:ring-ring/20">
                  <textarea
                    aria-label="Message"
                    className="max-h-44 min-h-12 w-full resize-y bg-transparent px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-muted-foreground"
                    disabled={isGenerating}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={onComposerKeyDown}
                    placeholder="Message your workspace…"
                    ref={composer}
                    value={draft}
                  />
                  <div className="flex items-center justify-between px-1 pb-1">
                    <span className="pl-2 text-[11px] text-muted-foreground">
                      Enter to send · Shift + Enter for a new line
                    </span>
                    {isGenerating ? (
                      <Button
                        aria-label="Stop response"
                        className="size-9 rounded-xl"
                        onClick={stopGeneration}
                        type="button"
                      >
                        <Square aria-hidden="true" className="size-3.5 fill-current" />
                      </Button>
                    ) : (
                      <Button
                        aria-label="Send message"
                        className="size-9 rounded-xl"
                        disabled={!draft.trim() || uploadProgress !== null}
                        type="submit"
                      >
                        <ArrowUp aria-hidden="true" className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="pt-2 text-center text-[10px] text-muted-foreground">
                  Demo responses may be inaccurate and do not analyze your documents.
                </p>
              </form>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="mb-5 grid size-14 place-items-center rounded-2xl border bg-card shadow-sm">
                <FolderOpen aria-hidden="true" className="size-6" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {workspace.data.name}
              </h1>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {workspace.data.description ||
                  "Start a new chat or add documents to give this workspace a home."}
              </p>
              <Button className="mt-6 gap-2 rounded-xl" onClick={() => void startNewChat()}>
                <MessageSquarePlus aria-hidden="true" className="size-4" />
                Start a chat
              </Button>
              <div className="mt-10 flex gap-6 text-center">
                <div>
                  <p className="text-xl font-semibold">{workspace.data.documentCount}</p>
                  <p className="text-xs text-muted-foreground">Documents</p>
                </div>
                <div className="h-10 w-px bg-border" />
                <div>
                  <p className="text-xl font-semibold">{workspace.data.conversationCount}</p>
                  <p className="text-xs text-muted-foreground">Conversations</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function ConversationRow({
  conversation,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  conversation: ConversationDto;
  active: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-1 rounded-lg px-1 transition ${
        active ? "bg-muted" : "hover:bg-muted/70"
      }`}
    >
      <button
        className="flex h-9 min-w-0 flex-1 items-center gap-2 px-1.5 text-left text-xs outline-none focus-visible:underline"
        onClick={onSelect}
        type="button"
      >
        <MessageSquarePlus aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{conversation.title}</span>
      </button>
      <button
        aria-label={`Rename ${conversation.title}`}
        className="grid size-7 shrink-0 place-items-center rounded text-muted-foreground opacity-100 hover:bg-background hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
        onClick={onRename}
        type="button"
      >
        <MoreHorizontal aria-hidden="true" className="size-3.5" />
      </button>
      <button
        aria-label={`Delete ${conversation.title}`}
        className="grid size-7 shrink-0 place-items-center rounded text-muted-foreground opacity-100 hover:bg-background hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
        onClick={onDelete}
        type="button"
      >
        <Trash2 aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}

function MessageBubble({ message }: { message: MessageDto }) {
  const isUser = message.role === "user";
  return (
    <article className={`flex gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser && (
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-xs font-semibold text-primary-foreground">
          K
        </span>
      )}
      <div
        className={`min-w-0 max-w-[88%] ${
          isUser
            ? "rounded-2xl bg-muted px-4 py-3 text-sm leading-6 sm:max-w-[80%]"
            : "flex-1 pt-1 text-sm leading-7"
        }`}
      >
        {isUser ? message.content : <MarkdownContent content={message.content} />}
      </div>
    </article>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        a: ({ children, ...props }) => (
          <a className="underline underline-offset-4" rel="noreferrer" target="_blank" {...props}>
            {children}
          </a>
        ),
        code: ({ children, className, ...props }) => (
          <code
            className={`${className ?? ""} rounded bg-muted px-1.5 py-0.5 text-[0.9em]`}
            {...props}
          >
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="my-3 overflow-x-auto rounded-xl border bg-muted/50 p-4 text-xs leading-6">
            {children}
          </pre>
        ),
        p: ({ children }) => <p className="my-2 last:mb-0">{children}</p>,
        ul: ({ children }) => (
          <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
        ),
      }}
      remarkPlugins={[remarkGfm]}
    >
      {content}
    </ReactMarkdown>
  );
}
