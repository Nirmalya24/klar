import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        surface: "#f8f8f7",
        ink: "#21252a"
      },
      boxShadow: {
        zanshin: "0 20px 40px rgba(0, 0, 0, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
