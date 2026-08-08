import "./globals.css";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";
import { PublicShell } from "@/components/layout/PublicShell";

/**
 * Inter, self-hosted. Previously `Inter` from next/font/google.
 *
 * next/font/google downloads the font during `next build`, so the build failed
 * outright whenever Google was unreachable:
 *
 *   request to https://fonts.googleapis.com/css2?family=Inter:wght@100..900
 *     failed, reason: connect ETIMEDOUT 108.177.125.95:443
 *   `next/font` error: Failed to fetch `Inter` from Google Fonts.
 *
 * That is not a local-only annoyance — the same timeout during a Vercel
 * deployment fails the deploy. `fallback` and `display` do not help: they
 * govern how text renders in the browser, not whether the build fetches.
 *
 * The woff2 now lives in the repository (./fonts), so the build has no network
 * dependency at all and no request leaves the user's browser for a font.
 * It is the latin subset of the variable face — matching the previous
 * `subsets: ["latin"]` — so the rendered typography is unchanged.
 */
const inter = localFont({
  src: "./fonts/Inter-latin-variable.woff2",
  variable: "--font-inter",
  display: "swap",
  // Variable font: one file covers the whole weight range.
  weight: "100 900",
  style: "normal",
  fallback: ["system-ui", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
  // For local fonts this names the metric-matched stand-in, rather than being
  // a boolean as it is for the Google loader.
  adjustFontFallback: "Arial",
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
        {/*
          One shell for every public route. It owns the <main> landmark and the
          page background too, so spacing and surface are defined in the same
          place as the header and footer rather than re-declared per page.
        */}
        <PublicShell>{children}</PublicShell>
      </body>
    </html>
  );
}
