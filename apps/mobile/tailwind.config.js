/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{tsx,ts}", "./src/**/*.{tsx,ts}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#1c1e26",
        "surface-lowest": "#12141b",
        "surface-low": "#1e2029",
        surface: "#262832",
        "surface-high": "#323440",
        "surface-highest": "#404352",
        "on-surface": "#f0f0f6",
        "on-surface-variant": "#d7d8e2",
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
