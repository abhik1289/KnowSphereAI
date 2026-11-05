import React from "react";
import "@/app/globals.css";
// import layout from "../layout";

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

export default AuthLayout;
