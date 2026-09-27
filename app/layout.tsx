import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_Mono, Permanent_Marker, Roboto_Condensed } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
// Fonts that mirror what Rust ships for CUI text.
const robotoCondensed = Roboto_Condensed({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700"],
  variable: "--font-roboto-condensed",
});
const marker = Permanent_Marker({ subsets: ["latin"], weight: "400", variable: "--font-marker" });
const droidMono = Noto_Sans_Mono({ subsets: ["latin", "cyrillic"], variable: "--font-droid-mono" });

export const metadata: Metadata = {
  title: "RustCUI Editor — visual UI builder for Rust plugins",
  description:
    "Design Rust CUI in the browser: drag, anchor, style and export ready-to-use JSON or C# for Oxide / Carbon plugins.",
};

export const viewport: Viewport = { themeColor: "#0b0c0e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable} ${robotoCondensed.variable} ${marker.variable} ${droidMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
