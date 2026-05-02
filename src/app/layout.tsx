import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Number Storm",
  description: "A chaotic ball-drop game — guide falling digits into your phone number",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he">
      <body className="overflow-hidden">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
