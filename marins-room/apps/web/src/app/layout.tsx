import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Marin's Room",
    template: "%s | Marin's Room",
  },
  description: "Welcome to Marin's personal space on the web",
  openGraph: {
    title: "Marin's Room",
    description: "Welcome to Marin's personal space on the web",
    type: "website",
    locale: "en_US",
    siteName: "Marin's Room",
  },
  twitter: {
    card: "summary_large_image",
    title: "Marin's Room",
    description: "Welcome to Marin's personal space on the web",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
