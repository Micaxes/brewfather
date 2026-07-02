import type { Metadata } from "next";
import { Hanken_Grotesk, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-hanken",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Brewable — what can I brew now?",
  description:
    "Match your Brewfather inventory against your saved recipes to see what you can brew right now.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark h-full antialiased ${hanken.variable} ${spaceGrotesk.variable}`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
