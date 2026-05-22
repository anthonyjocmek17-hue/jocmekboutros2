import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f6f5f2",
        ink: "#0f172a",
        accent: "#9a3412",
        accent2: "#0ea5e9",
        success: "#059669",
        surface: "rgba(255,255,255,.72)",
        "surface-strong": "rgba(255,255,255,.9)",
        muted: "rgba(15,23,42,.62)"
      },
      boxShadow: {
        menu: "0 1px 0 rgba(2,6,23,.06), 0 16px 40px rgba(2,6,23,.10)",
        soft: "0 1px 0 rgba(2,6,23,.05), 0 10px 24px rgba(2,6,23,.08)"
      }
    }
  },
  plugins: []
} satisfies Config;

