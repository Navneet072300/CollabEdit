import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CollabEdit — Real-Time Collaborative Code Editor",
  description: "Edit code together, in real time.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body>{children}</body>
    </html>
  );
}
