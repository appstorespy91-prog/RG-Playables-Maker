/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        base: {
          bg: "#0f1117",
          panel: "#161922",
          panel2: "#1c202c",
          border: "#262b38",
          muted: "#8b93a7",
        },
        accent: {
          DEFAULT: "#6366f1",
          hover: "#818cf8",
          dark: "#4f46e5",
        },
        ok: "#22c55e",
        warn: "#eab308",
        danger: "#ef4444",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(99,102,241,0.4), 0 8px 24px rgba(99,102,241,0.25)",
      },
      keyframes: {
        "check-pop": {
          "0%": { transform: "scale(0)", opacity: "0" },
          "60%": { transform: "scale(1.15)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "check-pop": "check-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
        "fade-in": "fade-in 0.35s ease both",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [],
};
