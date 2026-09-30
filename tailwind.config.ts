import type { Config } from "tailwindcss";

// Colores de BACOLI: crema #ede6c8, verde #026433 y rojo #aa0e1d. Cada uno con su escala (el 700 del verde y del rojo
// y el 200 de la crema son los colores exactos de la marca).
// Uso: verde = acciones y marca; crema = fondos y detalles suaves; rojo = avisos, deuda y acciones que borran.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        crema: { 50: "#faf7ec", 100: "#f5f0dc", 200: "#ede6c8", 300: "#e0d7ae", 400: "#cdbf8a" },
        verde: { 50: "#eef6f1", 100: "#d5e9dd", 200: "#abd3bc", 300: "#6fb58f", 400: "#349366", 500: "#0f7a47", 600: "#037a40", 700: "#026433", 800: "#014d27", 900: "#013a1d" },
        rojo: { 50: "#fbeced", 100: "#f6d3d6", 200: "#ebaab0", 300: "#dc7a84", 400: "#c94452", 500: "#b81f30", 600: "#b0121f", 700: "#aa0e1d", 800: "#880b17", 900: "#6a0912" },
      },
    },
  },
  plugins: [],
};

export default config;
