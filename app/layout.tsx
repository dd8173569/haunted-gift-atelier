import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Haunted Gift Atelier — Tiny Tiaraa",
  description:
    "Find the right baby-jewelry gift by conversation — then prove it's safe, see it true to size, and wrap it beautifully. Real catalog: Tiny Tiaraa.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-pearl text-plum font-sans">
        {/* searchParams on /find, /picks and /atelier is runtime data; Cache Components needs a
            Suspense boundary above it or the prerender of the route fails. */}
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  );
}
