import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import Layout from "./components/Layout";
import ClientWalletProvidersWrapper from "./components/ClientWalletProvidersWrapper";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Synq – Onchain Trading Terminal",
  description: "Real-time onchain terminal for stocks, meme coins, tokens, and prediction markets across venues like Kalshi and Polymarket.",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Prefetch trending markets for fast homepage load */}
        <link rel="prefetch" href="/api/markets/trending?limit=9" as="fetch" crossOrigin="anonymous" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} antialiased`}
      >
        <ClientWalletProvidersWrapper>
          <Layout>
            <Suspense fallback={null}>
              {children}
            </Suspense>
          </Layout>
        </ClientWalletProvidersWrapper>
      </body>
    </html>
  );
}
