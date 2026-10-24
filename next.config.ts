import type { NextConfig } from "next";

// imapflow y mailparser (lectura de los mails de la tienda) corren solo en el servidor y no se empaquetan.
const nextConfig: NextConfig = { serverExternalPackages: ["imapflow", "mailparser", "nodemailer"] };

export default nextConfig;
