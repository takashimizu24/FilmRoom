import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import { SearchProvider } from "@/components/SearchContext";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import { themeInitScript } from "@/lib/theme";

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
  // Dark is the CSS default; the theme init script rewrites this tag when the
  // device is set to (or prefers) light.
  themeColor: "#08080a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The init script below sets `data-theme` on <html> before React hydrates,
    // so the attribute is expected to differ from the server-rendered markup.
    <html lang="en" className={`${geistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-geist-sans)]">
        {/* First thing in the body, so the chosen theme is in place before the
            page paints rather than flashing dark and then correcting. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
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
