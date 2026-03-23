import type { Metadata } from "next";
import { Lexend, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { VersionCheck } from "@/components/version-check";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "VibrantSocial",
    template: "%s - VibrantSocial",
  },
  description:
    "Social media for adults. No algorithms, no AI nonsense — just self expression.",
  openGraph: {
    siteName: "VibrantSocial",
    type: "website",
  },
  twitter: {
    card: "summary",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`${lexend.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <VersionCheck />
          <Header />
          {children}
          <Footer />
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
