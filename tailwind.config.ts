import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:      "#0a0a0b",
        surface: "#111113",
        edge:    "#1c1c1f",
        line:    "rgba(255,255,255,0.07)",
      },
      fontFamily: {
        mono: ["'Space Mono'", "monospace"],
        sans: ["'Inter'", "sans-serif"],
      },
      animation: {
        "pulse-ring":  "pulseRing 2.4s ease-out infinite",
        "scan-line":   "scanLine 3.5s linear infinite",
        "blink":       "blink 1.1s step-end infinite",
        "marquee":     "marquee 28s linear infinite",
        "marquee2":    "marquee2 28s linear infinite",
      },
      keyframes: {
        pulseRing: {
          "0%":   { transform: "scale(1)",   opacity: "0.6" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        scanLine: {
          "0%":   { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        blink: {
          "0%,100%": { opacity: "1" },
          "50%":     { opacity: "0" },
        },
        marquee: {
          "0%":   { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        marquee2: {
          "0%":   { transform: "translateX(50%)" },
          "100%": { transform: "translateX(0%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
