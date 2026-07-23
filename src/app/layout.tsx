import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import Header from "@/components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FilmRoom",
  description: "Video analysis & team sharing",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FilmRoom",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-neutral-950 font-[family-name:var(--font-geist-sans)]">
        <SessionProvider>
          <Header />
          <main className="flex-1">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
