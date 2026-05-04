/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eef7ff",
          100: "#d9ecff",
          200: "#bcdfff",
          300: "#8ecbff",
          400: "#5aaeff",
          500: "#2f8df8",
          600: "#1c70de",
          700: "#1759b3",
          800: "#194b8e",
          900: "#1a3f70"
        },
        up:   "#16a34a",
        down: "#dc2626"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"]
      }
    }
  },
  plugins: []
};
