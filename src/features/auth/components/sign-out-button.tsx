"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      onClick={() => signOut({ redirectTo: "/login" })}
      type="button"
      variant="outline"
    >
      Sign out
    </Button>
  );
}
