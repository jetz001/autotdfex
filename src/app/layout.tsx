import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://autotdfex.pages.dev"),
  title: "autoTDFex — Autonomous Futures Trading Terminal",
  description: "Enterprise Bitget USDT-M Perpetual Futures Autonomous Quant Terminal with Multi-Model AI Decision Engine. Two-way Hedge Mode, 5x Cross Leverage.",
  openGraph: {
    title: "autoTDFex — Futures Quant AI Terminal",
    description: "Bitget USDT-M Perpetual Futures Autonomous Trading — Hedge Mode, Long & Short, 5x Cross.",
    type: "website",
    url: "https://autotdfex.pages.dev",
  },
  twitter: {
    card: "summary_large_image",
    title: "autoTDFex — Futures Quant AI Terminal",
    description: "Bitget USDT-M Perpetual Futures Autonomous Trading",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased font-sans`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <AuthProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
