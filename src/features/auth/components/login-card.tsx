import { Sparkles } from "lucide-react";
import { GoogleSignInButton } from "./google-sign-in-button";

export function LoginCard() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <section className="w-full max-w-md rounded-3xl border bg-card p-8 shadow-sm sm:p-10">
        <div className="mb-8 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Sparkles aria-hidden="true" className="size-6" />
        </div>

        <p className="text-sm font-medium text-muted-foreground">
          Welcome to Knowsphere
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Sign in to your account
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Continue with your Google account to access your workspace.
        </p>

        <div className="my-8 h-px bg-border" />
        <GoogleSignInButton />
        <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
          By continuing, you agree to use your Google account to securely sign
          in to Knowsphere.
        </p>
      </section>
    </main>
  );
}
