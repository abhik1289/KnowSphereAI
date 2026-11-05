import type { ReactNode } from "react";
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
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <p className="font-semibold">Knowsphere</p>
          <p className="text-sm text-muted-foreground">{name ?? email}</p>
        </div>
        <SignOutButton />
      </header>
      {children}
    </>
  );
}
