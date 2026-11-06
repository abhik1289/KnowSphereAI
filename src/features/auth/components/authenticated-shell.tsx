import type { ReactNode } from "react";
import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

type AuthenticatedShellProps = {
  children: ReactNode;
  name: string | null | undefined;
  email: string | null | undefined;
};

export function AuthenticatedShell({
  children,
  name,
  email,
}: AuthenticatedShellProps) {
  return (
    <>
      <header className="flex min-h-[73px] items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-6">
          <Link className="font-semibold" href="/workspace">
            Knowsphere
          </Link>
          <Link
            className="text-sm text-muted-foreground transition hover:text-foreground"
            href="/workspace"
          >
            Workspaces
          </Link>
          <p className="hidden text-sm text-muted-foreground sm:block">
            {name ?? email}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground sm:hidden">
            {name ?? email}
          </p>
          <SignOutButton />
        </div>
      </header>
      {children}
    </>
  );
}
