import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Cormorant_Garamond, Inter } from "next/font/google";
import SkipLink from "../components/SkipLink";
import { SITE_TITLE, TITLE_TEMPLATE } from "../lib/page-meta";
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
  title: { default: SITE_TITLE, template: TITLE_TEMPLATE },
  description:
    "Find the right baby-jewelry gift by conversation — then get a plain-language fit check, see it at a size you calibrate, and wrap it beautifully. Real catalog: Tiny Tiaraa.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-pearl text-plum font-sans">
        <SkipLink />
        {/* searchParams on /find, /picks and /atelier is runtime data; Cache Components needs a
            Suspense boundary above it or the prerender of the route fails. */}
        <Suspense fallback={null}>{children}</Suspense>
      </body>
    </html>
  );
}
