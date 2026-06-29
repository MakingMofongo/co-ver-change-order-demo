import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Change Order Review",
  description:
    "Review construction change orders against the contract baseline — extract line items, flag likely overbilling, and sign off each finding.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
