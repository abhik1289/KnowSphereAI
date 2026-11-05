import React from "react";
import { BrainCircuit, Construction, Sparkles } from "lucide-react";

function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080B14] px-6 text-white">
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto mb-8 flex size-16 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10">
          <BrainCircuit className="size-8 text-indigo-400" />
        </div>

        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-4 py-2 text-xs font-medium text-indigo-300">
          <span className="size-2 animate-pulse rounded-full bg-indigo-400" />
          UNDER DEVELOPMENT
        </div>

        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          KnowSphere AI
        </h1>

        <p className="mt-5 text-xl font-medium text-slate-300">
          Something intelligent is in progress.
        </p>

        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-slate-400">
          We're working hard to build a smarter way to manage your documents,
          organize knowledge, and interact with AI. Stay tuned!
        </p>

        <div className="mt-10 flex items-center justify-center gap-2 text-sm text-slate-500">
          <Sparkles className="size-4 text-indigo-400" />
          Crafted with intelligence. Coming soon.
        </div>

        <div className="mt-16 border-t border-white/[0.08] pt-6 text-xs text-slate-600">
          © {new Date().getFullYear()} KnowSphere AI. All rights reserved.
        </div>
      </div>
    </main>
  );
}

export default Page;
