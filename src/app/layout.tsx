import "./globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: "SignLang FSL - AI-Powered Filipino Sign Language Translation",
  description: "Real-time FSL recognition, text-to-sign animation, and an interactive learning platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("scroll-smooth", inter.variable)}>
      <body className="flex min-h-screen flex-col bg-warm-ivory font-sans text-deep-navy">
        <a
          href="#main-content"
          className="absolute top-0 left-0 z-50 -translate-y-full bg-vibrant-sky p-4 text-white focus:translate-y-0"
        >
          Skip to main content
        </a>
        <Header />
        <main id="main-content" className="flex-grow">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
