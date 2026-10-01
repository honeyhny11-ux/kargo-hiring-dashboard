import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kargo Hiring Dashboard",
  description: "Ranked PM and SPM shortlists calibrated on Kargo's best past hires.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <span className="brand">Kargo Hiring</span>
          <nav>
            <Link href="/">Shortlist</Link>
            <Link href="/upload">Upload CVs</Link>
            <Link href="/rubric">Rubric</Link>
            <Link href="/activity">Activity</Link>
          </nav>
          <span className="muted small" style={{ marginLeft: "auto" }}>The system recommends. Arjun decides.</span>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
