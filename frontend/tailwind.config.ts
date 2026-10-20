import type { Config } from "tailwindcss";

const SYSTEM_SANS = ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"];

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Self-hosted via @fontsource (no network fetch at build time).
        sans: ['"Geist Variable"', ...SYSTEM_SANS],
        display: ['"Bricolage Grotesque Variable"', '"Geist Variable"', ...SYSTEM_SANS],
        mono: ['"Geist Mono Variable"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        // "Ink & gold": a warm near-black canvas, ivory text, one confident
        // brass accent. Green/red are reserved strictly for gains/losses.
        background: "#07080B",
        surface: "#10131A",
        surfaceHover: "#171B24",
        border: "#1F232D",
        ink: "#F3F0E8",
        muted: "#8E93A0",
        dim: "#5D626E",
        primary: "#F5B94A",
        primaryHover: "#FFCB6B",
        primaryDeep: "#C98A1B",
        positive: "#3DDC97",
        negative: "#FF6B6B",
        warning: "#FF9F43",
        iris: "#8B9BFF",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(245,185,74,0.25), 0 8px 40px -8px rgba(245,185,74,0.35)",
        lift: "0 18px 50px -18px rgba(0,0,0,0.8)",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        popIn: {
          "0%": { opacity: "0", transform: "translateY(6px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.45", transform: "scale(0.85)" },
        },
        floatY: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        typing: {
          "0%, 80%, 100%": { opacity: "0.25", transform: "translateY(0)" },
          "40%": { opacity: "1", transform: "translateY(-3px)" },
        },
      },
      animation: {
        "fade-up": "fadeUp 0.55s cubic-bezier(0.2,0.7,0.2,1) both",
        "fade-in-up": "fadeUp 0.45s cubic-bezier(0.2,0.7,0.2,1) both",
        "fade-in": "fadeIn 0.4s ease-out both",
        "pop-in": "popIn 0.18s cubic-bezier(0.2,0.7,0.2,1) both",
        shimmer: "shimmer 1.6s ease-in-out infinite",
        marquee: "marquee 38s linear infinite",
        "pulse-dot": "pulseDot 1.8s ease-in-out infinite",
        float: "floatY 7s ease-in-out infinite",
        typing: "typing 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
