import type { ReactNode } from "react";
import Link from "next/link";
import { SignOutButton } from "./sign-out-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
type AuthenticatedShellProps = {
  children: ReactNode;
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
};

export function AuthenticatedShell({
  children,
  name,
  email,
  image,
}: AuthenticatedShellProps) {
  return (
    <>
      <header className="flex min-h-[73px] items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-6">
          <Link className="font-semibold" href="/workspace">
            Knowsphere
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Avatar>
            {image && <AvatarImage src={image} />}
            <AvatarFallback>{name}</AvatarFallback>
          </Avatar>
          {name && (
            <div className="profile_info text-sm">
              <span>{name}</span>
              <p>{email}</p>
            </div>
          )}
          <SignOutButton />
        </div>
      </header>
      {children}
    </>
  );
}
