import type { Metadata } from "next";
import { Lexend, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { VersionCheck } from "@/components/version-check";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["300", "400"],
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const host = (await headers()).get("host") || "";
  const isLinksSubdomain = host.startsWith("links.");

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* DNS prefetch for external services used after initial paint */}
        <link rel="dns-prefetch" href="https://realtime.ably.io" />
        <link rel="dns-prefetch" href="https://rest.ably.io" />
        <link rel="dns-prefetch" href="https://va.vercel-scripts.com" />
        <link rel="dns-prefetch" href="https://lh3.googleusercontent.com" />
      </head>
      <body
        className={`${lexend.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {!isLinksSubdomain && <VersionCheck />}
          {!isLinksSubdomain && <Header />}
          {children}
          {!isLinksSubdomain && <Footer />}
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
