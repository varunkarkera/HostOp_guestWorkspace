import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "HostOp | Guest workspace", description: "A thoughtful workspace for every guest conversation.", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}