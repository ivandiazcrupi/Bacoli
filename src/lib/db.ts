import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Conexión a la base con límites sanos (para que no se acumulen conexiones ni se cuelgue esperando):
// hasta 5 conexiones, 20 s de espera por una libre y 15 s para conectar. Si la dirección ya trae esos valores, se respetan.
function direccionConLimites() {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "5");
    if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "20");
    if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "15");
    return u.toString();
  } catch {
    return url;
  }
}

const url = direccionConLimites();
export const db = globalForPrisma.prisma ?? new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
