import type { Metadata } from "next";
import { Fredoka, Nunito, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const fredoka = Fredoka({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-fredoka" });
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-nunito" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-jetbrains" });

const DESCRIPTION =
  "No-loss prize savings where nobody — not even the pool — knows who won. Deposits, balances, odds and winnings stay encrypted on Zama fhEVM.";

export const metadata: Metadata = {
  metadataBase: new URL("https://samar-pool.vercel.app"),
  title: "Samar Saving — Confidential Prize Savings",
  description: DESCRIPTION,
  openGraph: {
    title: "Samar Saving — Confidential Prize Savings",
    description: DESCRIPTION,
    url: "https://samar-pool.vercel.app",
    siteName: "Samar Saving",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Samar Saving — Confidential Prize Savings",
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable} ${jetbrains.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,500,1,0"
        />
      </head>
      <body className="min-h-screen bg-page font-body text-txt antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
