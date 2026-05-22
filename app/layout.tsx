import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitLedger — Your Review Has Skin in the Game",
  description:
    "GitLedger transforms PR code reviews into staked EAS attestations on Base L2. Stake USDC on every review. Earn yield for clean code. Get slashed for bugs.",
  openGraph: {
    title: "GitLedger — Your Review Has Skin in the Game",
    description: "Stake your reputation. Every PR review on-chain.",
    siteName: "GitLedger",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="noise">{children}</body>
    </html>
  );
}
