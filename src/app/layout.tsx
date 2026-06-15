import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Aigent OS — Receptionist",
  description: "AI receptionist API for same-day field-service businesses.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          margin: 0,
          padding: "3rem 1.5rem",
          lineHeight: 1.55,
          color: "#0b1220",
          background: "#f4f6f8",
        }}
      >
        {children}
      </body>
    </html>
  );
}
