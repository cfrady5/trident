import type { Metadata, Viewport } from "next";
import "./globals.css";
import { site } from "@/content/site";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: `Trident · ${site.tagline}`, template: "%s · Trident" },
  description: site.oneLine,
  openGraph: { siteName: "Trident", type: "website", images: ["/brand/lockup-gold.png"] },
  robots: process.env.APP_ENV === "production" ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black">{children}</body>
    </html>
  );
}
