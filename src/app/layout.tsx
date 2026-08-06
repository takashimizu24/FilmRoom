import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import { SearchProvider } from "@/components/SearchContext";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";

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
      <body className="min-h-full flex flex-col font-[family-name:var(--font-geist-sans)]">
        <SessionProvider>
          <SearchProvider>
            <Header />
            {/* Extra bottom padding on phones so the floating BottomNav never covers content. */}
            <main className="flex-1 pb-28 sm:pb-0">{children}</main>
            <BottomNav />
          </SearchProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
