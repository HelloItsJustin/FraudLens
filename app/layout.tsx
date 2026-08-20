import type { Metadata } from "next";
import { IBM_Plex_Mono, Piazzolla, Source_Serif_4 } from "next/font/google";
import "@/app/globals.css";

const piazzolla = Piazzolla({ variable: "--font-fraunces", subsets: ["latin"], weight: ["500", "600", "700"], display: "swap", adjustFontFallback: false });
const sourceSerif = Source_Serif_4({ variable: "--font-newsreader", subsets: ["latin"], weight: ["500", "600", "700"], display: "swap", adjustFontFallback: false });
const ibmPlexMono = IBM_Plex_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", adjustFontFallback: false });

export const metadata: Metadata = {
  title: "FraudLens — Intelligence",
  description: "Explainable live fraud-ring detection by Team XCalibur.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${piazzolla.variable} ${sourceSerif.variable} ${ibmPlexMono.variable}`}><body>{children}</body></html>;
}
