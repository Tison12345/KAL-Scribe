import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "kal-scribe",
  description: "Clinical AI documentation assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Material Symbols Outlined, loaded via <link> per
            docs/design/ui-reference.md §7 — matches how the existing
            CMS loads it too, so next/next's page-scoped-font rule
            (written for the pages/ router, not applicable to a root
            App Router layout) is a known false positive here.
            display=block (not the lint-suggested `optional`) is
            deliberate: this is an icon font, not a text font — its
            "fallback" is literal unreadable text like "verified_user",
            so icons must wait for the font rather than risk never
            swapping in. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/google-font-display */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
      </head>
      <body className={`${manrope.className} antialiased`}>{children}</body>
    </html>
  );
}
