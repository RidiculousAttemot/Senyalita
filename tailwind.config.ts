import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "warm-ivory": "#FDF8F0",
        "soft-cream": "#FBF5E9",
        "deep-navy": "#12333A",
        "muted-teal": "#6f8792",
        "terracotta": "#E2725B",
        "light-gray": "#F3F4F6",
        "bg-dark": "#102a33",
        primary: "#176e75",
        "primary-hover": "#11595f",
        "primary-light": "#e1f3f2",
        "text-dark": "#12303a",
        "text-sub": "#4b646f",
        "text-muted": "#6f8792",
        border: "#d5e7ea",
        "warn-bg": "#fff4e8",
        "warn-border": "#f0c8a5",
        "warn-text": "#9a5f2b",
        // Translation workspace palette — scoped to /translate.
        fsl: {
          bg: "#FDF8F0",
          surface: "#FFFFFF",
          raised: "#FFFCF7",
          sunken: "#FBF4EA",
          border: "#EDE2D6",
          "border-strong": "#DFD0BF",
          ink: "#2B221C",
          body: "#5C4F44",
          muted: "#8C7D6E",
          faint: "#B3A697",
          coral: "#D8694A",
          "coral-dark": "#BC573C",
          "coral-soft": "#FBEDE7",
          navy: "#123B47",
          teal: "#3F7F79",
          "teal-soft": "#E8F2F0",
          success: "#3E8E5E",
          "success-soft": "#E7F3EB",
          amber: "#A9701F",
          "amber-soft": "#FBF0DC",
        },
        // Senyalita landing-page palette — scoped to "/" only, see .claude/skills.
        "senyalita-primary": "#2563EB",
        "senyalita-secondary": "#3B82F6",
        "senyalita-accent": "#22C55E",
        "senyalita-warm": "#F8FAFC",
        "senyalita-surface": "#FFFFFF",
        "senyalita-dark": "#0F172A",
        "senyalita-text": "#1E293B",
        "senyalita-muted": "#64748B",
        "senyalita-border": "#E2E8F0",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        display: ["var(--font-cal)", "sans-serif"],
      },
      animation: {
        "float-slow": "float 8s ease-in-out infinite",
        "float-medium": "float 6s ease-in-out infinite",
        "float-fast": "float 4s ease-in-out infinite",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        "draw-line": "draw-line 1.8s ease-out forwards",
        marquee: "marquee 28s linear infinite",
        shimmer: "shimmer 1.6s ease-in-out infinite",
        "breathe-slow": "breathe-slow 3.2s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.15)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "breathe-slow": {
          "0%, 100%": { opacity: "0.55", transform: "scale(1)" },
          "50%": { opacity: "0.85", transform: "scale(1.03)" },
        },
        "draw-line": {
          "0%": { strokeDashoffset: "1" },
          "100%": { strokeDashoffset: "0" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
