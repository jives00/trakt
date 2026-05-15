/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{tsx,ts}", "./src/**/*.{tsx,ts}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#1d1d1d",
        "surface-lowest": "#0c0f0f",
        "surface-low": "#1a1c1c",
        surface: "#1e2020",
        "surface-high": "#282a2b",
        "surface-highest": "#333535",
        "on-surface": "#e2e2e2",
        "on-surface-variant": "#cccccc",
        accent: "#e8002d",
        "accent-hover": "#d40026",
        "accent-light": "#ff1a4a",
        error: "#ffb4ab",
        "error-container": "#93000a",
        outline: "rgba(255,255,255,0.1)",
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
