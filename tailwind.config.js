/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Cormorant Garamond"', '"Noto Serif SC"', "serif"],
        sans: ['Inter', '"Noto Sans SC"', "sans-serif"],
      },
      animation: {
        "breath": "breath 7s ease-in-out infinite",
      },
      keyframes: {
        breath: {
          "0%, 100%": { opacity: "0.06" },
          "50%": { opacity: "0.15" },
        },
      },
    },
  },
  plugins: [],
}
