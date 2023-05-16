/** @type {import('tailwindcss').Config} */
import daisyui from "daisyui";
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  daisyui: {
    themes: [
      {
        mytheme: {
          "primary": "#4A5A9C",
          "secondary": "#B11012",
          "accent": "#7B7B7F",
          "neutral": "#bfdbfe",
          "base-100": "#F3F4F7",
          "info": "#16244A",
          "success": "#22c55e",
          "warning": "#fde047",
          "error": "#d946ef",
        },
      },
    ],
  },
  theme: {
    extend: {
      fontFamily:{
        'zen': ['Zen Dots', 'sans-serif']
      },
      colors: {
      }
    },
  },
  plugins: [daisyui],
}

