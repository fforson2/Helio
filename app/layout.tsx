import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { HelioEntryAnimation } from "@/components/layout/helio-entry-animation";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Helio — AI Real Estate OS",
  description:
    "From search to signed in one session. AI-powered property discovery, deal analysis, and agent collaboration.",
  icons: {
    icon: "/helio-mark-clean.png",
    shortcut: "/helio-mark-clean.png",
    apple: "/helio-mark-clean.png",
  },
  openGraph: {
    title: "Helio",
    description: "AI-powered real estate operating system",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased`}>
        <TooltipProvider>
          <HelioEntryAnimation />
          {children}
          <Toaster position="bottom-right" richColors />
        </TooltipProvider>
      </body>
    </html>
  );
}
