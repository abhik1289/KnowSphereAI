import type { ReactNode } from "react";
import { connection } from "next/server";
import { AuthenticatedShell } from "@/features/auth/components/authenticated-shell";
import { requireAuth } from "@/features/auth/server/require-auth";
import "@/app/globals.css";

export const instant = false;

export default async function MainCoreLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();
  const session = await requireAuth();

  return (
    <html lang="en">
      <body>
        <AuthenticatedShell email={session.user.email} name={session.user.name}>
          {children}
        </AuthenticatedShell>
      </body>
    </html>
  );
}
