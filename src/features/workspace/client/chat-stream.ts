"use client";

import { z } from "zod";
import {
  ApiErrorSchema,
  ChatMessageSchema,
} from "../shared/schemas";

const startEventSchema = z.object({ messageId: z.string().uuid() });
const deltaEventSchema = z.object({ content: z.string() });
const completeEventSchema = z.object({ messageId: z.string().uuid() });
const streamErrorSchema = z.object({ message: z.string() });

type StreamCallbacks = {
  onStart: (messageId: string) => void;
  onDelta: (content: string) => void;
  onComplete: (messageId: string) => void;
};

export async function sendMessageStream(
  conversationId: string,
  input: { content: string; requestId: string },
  signal: AbortSignal,
  callbacks: StreamCallbacks,
) {
  const message = ChatMessageSchema.parse(input);
  const response = await fetch(
    `/api/user/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(message),
      signal,
    },
  );
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const error = ApiErrorSchema.safeParse(body);
    throw new Error(
      error.success ? error.data.error.message : "The message could not be sent.",
    );
  }
  if (!response.body) {
    throw new Error("The server did not start a response stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "";
  let dataLines: string[] = [];
  let completed = false;

  function dispatchEvent() {
    if (!eventName || dataLines.length === 0) {
      eventName = "";
      dataLines = [];
      return;
    }
    const data: unknown = JSON.parse(dataLines.join("\n"));
    switch (eventName) {
      case "message_start": {
        const event = startEventSchema.parse(data);
        callbacks.onStart(event.messageId);
        break;
      }
      case "message_delta": {
        callbacks.onDelta(deltaEventSchema.parse(data).content);
        break;
      }
      case "message_complete": {
        const event = completeEventSchema.parse(data);
        callbacks.onComplete(event.messageId);
        completed = true;
        break;
      }
      case "message_error": {
        throw new Error(streamErrorSchema.parse(data).message);
      }
      default:
        throw new Error("The server sent an unknown stream event.");
    }
    eventName = "";
    dataLines = [];
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line === "") {
          dispatchEvent();
        } else if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trimStart());
        }
      }
      if (done) break;
    }
    if (buffer) {
      if (buffer.startsWith("data:")) dataLines.push(buffer.slice(5).trimStart());
    }
    dispatchEvent();
    if (!completed) throw new Error("The response stream ended unexpectedly.");
  } finally {
    reader.releaseLock();
  }
}
