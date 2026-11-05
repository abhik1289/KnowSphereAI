import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export const getSession = cache(async () => auth());

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}
