import type { Config } from "tailwindcss";

// Colores de BACOLI: verde #026433 y rojo #aa0e1d. La "crema" pasó a ser un gris cálido muy claro (pedido del dueño: colores que no cansen la vista).
// (Antes: crema #ede6c8.) Cada uno con su escala (el 700 del verde y del rojo
// y el 200 de la crema son los colores exactos de la marca).
// Uso: verde = acciones y marca; crema = fondos y detalles suaves; rojo = avisos, deuda y acciones que borran.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        crema: { 50: "#faf9f7", 100: "#f4f3ef", 200: "#ebe9e3", 300: "#dddad2", 400: "#c6c2b7" },
        verde: { 50: "#eef6f1", 100: "#d5e9dd", 200: "#abd3bc", 300: "#6fb58f", 400: "#349366", 500: "#0f7a47", 600: "#037a40", 700: "#026433", 800: "#014d27", 900: "#013a1d" },
        rojo: { 50: "#fbeced", 100: "#f6d3d6", 200: "#ebaab0", 300: "#dc7a84", 400: "#c94452", 500: "#b81f30", 600: "#b0121f", 700: "#aa0e1d", 800: "#880b17", 900: "#6a0912" },
      },
    },
  },
  plugins: [],
};

export default config;
