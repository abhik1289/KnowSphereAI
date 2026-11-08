import type { ReactNode } from "react";
import { connection } from "next/server";
import { AuthenticatedShell } from "@/features/auth/components/authenticated-shell";
import { requireAuth } from "@/features/auth/server/require-auth";
import "@/app/globals.css";
import { Poppins } from "next/font/google";
export const instant = false;
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});
export default async function MainCoreLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();
  const session = await requireAuth();
  // console.log(session.user);
  return (
    <html lang="en">
      <body className={poppins.className}>
        <AuthenticatedShell
          image={session.user.image}
          email={session.user.email}
          name={session.user.name}>
          {children}
        </AuthenticatedShell>
      </body>
    </html>
  );
}
