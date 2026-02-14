/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./client/index.html", "./client/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%) skewX(-20deg)" },
          "100%": { transform: "translateX(200%) skewX(-20deg)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(0)" },
          "50%": { transform: "translateY(-20px) rotate(3deg)" },
        },
      },
      animation: {
        shimmer: "shimmer 3s linear infinite",
        float: "float 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
