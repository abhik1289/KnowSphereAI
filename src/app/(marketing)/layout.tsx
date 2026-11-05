import React from "react";
import "@/app/globals.css";

function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

export default MainLayout;
