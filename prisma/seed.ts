import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

// Crea el primer dueño a partir de variables de entorno. No pisa usuarios existentes.
const db = new PrismaClient();

async function main() {
  const nombre = process.env.SEED_ADMIN_NOMBRE;
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!nombre || !email || !password || password.length < 8) {
    throw new Error("Completá SEED_ADMIN_NOMBRE, SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD (mín. 8 caracteres).");
  }
  const existe = await db.usuario.findUnique({ where: { email } });
  if (existe) {
    console.log(`Ya existe ${email}. No se hizo nada.`);
    return;
  }
  await db.usuario.create({
    data: { nombre, email, rol: "DUENO", passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log(`Dueño creado: ${email}`);
}

main().finally(() => db.$disconnect());
