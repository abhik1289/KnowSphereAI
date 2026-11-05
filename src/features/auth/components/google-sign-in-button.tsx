"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function GoogleSignInButton() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setIsPending(true);
    setError(null);

    try {
      await signIn("google", { redirectTo: "/workspace" });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to start Google sign-in. Please try again.",
      );
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button
        className="h-11 w-full justify-center gap-3 rounded-xl text-sm font-medium"
        disabled={isPending}
        onClick={handleSignIn}
        type="button"
        variant="outline"
      >
        <span
          aria-hidden="true"
          className="grid size-5 place-items-center rounded-full border text-xs font-semibold"
        >
          G
        </span>
        {isPending ? "Connecting to Google..." : "Continue with Google"}
      </Button>
      {error && (
        <p aria-live="polite" className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
