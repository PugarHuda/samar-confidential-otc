import type { Metadata } from "next";
import { Fredoka, Nunito, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const fredoka = Fredoka({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-fredoka" });
const nunito = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-nunito" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-jetbrains" });

const DESCRIPTION = "Trade big. Nobody peeks. On-chain OTC where order size & price stay encrypted end to end, on Zama fhEVM.";

export const metadata: Metadata = {
  metadataBase: new URL("https://samar-otc.vercel.app"),
  title: "Samar — Confidential OTC Desk",
  description: DESCRIPTION,
  openGraph: {
    title: "Samar — Confidential OTC Desk",
    description: DESCRIPTION,
    url: "https://samar-otc.vercel.app",
    siteName: "Samar",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Samar — Confidential OTC Desk",
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
      <body className="font-body antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
