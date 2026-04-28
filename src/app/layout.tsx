import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Incremental Phone Number",
  description: "Fill the phone number by guiding falling digits with the wind",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="overflow-hidden">{children}</body>
    </html>
  );
}
