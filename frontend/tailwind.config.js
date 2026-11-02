/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"] },
      colors: {
        brand: {
          50: "#ecfbf8", 100: "#cff6ee", 200: "#a0ebdd", 300: "#69d9c8", 400: "#37c0af",
          500: "#1da596", 600: "#148379", 700: "#136a63", 800: "#14544f", 900: "#154643",
        },
        sand: { 50: "#faf8f4", 100: "#f3efe7", 200: "#e7e0d1" },
      },
      boxShadow: { card: "0 1px 2px rgba(20,40,50,.06), 0 4px 16px rgba(20,40,50,.05)" },
    },
  },
  plugins: [],
};
