import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./components/AuthProvider";
import Layout from "./components/Layout";
import PortalLoader from "./components/PortalLoader";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Prop Market - Professional Prediction Market Funding",
  description: "Institutional-grade prediction market prop trading platform",
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
        <AuthProvider>
          <PortalLoader>
            <Layout>
              <Suspense fallback={null}>
                {children}
              </Suspense>
            </Layout>
          </PortalLoader>
        </AuthProvider>
      </body>
    </html>
  );
}
