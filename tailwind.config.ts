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
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        display: ["var(--font-cal)", "sans-serif"],
      },
      animation: {
        "float-slow": "float 8s ease-in-out infinite",
        "float-medium": "float 6s ease-in-out infinite",
        "float-fast": "float 4s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
