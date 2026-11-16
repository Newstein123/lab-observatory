import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Universal Observatory", template: "%s · Universal Observatory" },
  description: "Configure a telescope, simulate what it shows, and keep your setups. Configure. Simulate. Preserve.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}>
        <ToastProvider>
          <SiteHeader />
          {/* Bottom padding leaves room for the mobile tab bar. */}
          <div className="pb-16 md:pb-0">{children}</div>
        </ToastProvider>
      </body>
    </html>
  );
}
