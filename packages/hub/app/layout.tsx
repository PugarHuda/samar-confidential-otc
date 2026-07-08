import type { Metadata } from "next";
import { Fredoka, Nunito, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-fredoka" });
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-nunito" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-jetbrains" });

const DESCRIPTION = "Three confidential-finance apps on Zama fhEVM — a private OTC desk, an ERC-20↔ERC-7984 wrapper registry, and an encrypted airdrop. On-chain finance where the numbers stay encrypted.";

export const metadata: Metadata = {
  metadataBase: new URL("https://samar-hub.vercel.app"),
  title: "Samar — a confidential-finance stack on Zama",
  description: DESCRIPTION,
  openGraph: { title: "Samar — a confidential-finance stack on Zama", description: DESCRIPTION, url: "https://samar-hub.vercel.app", siteName: "Samar", type: "website" },
  twitter: { card: "summary_large_image", title: "Samar — a confidential-finance stack on Zama", description: DESCRIPTION },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable} ${jetbrains.variable}`}>
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,500,1,0" />
      </head>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
