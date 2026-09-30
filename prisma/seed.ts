import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

// Crea el primer dueño a partir de variables de entorno. No pisa usuarios existentes.
const db = new PrismaClient();

async function main() {
  const nombre = process.env.SEED_ADMIN_NOMBRE;
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!nombre || !email || !password || password.length < 8) {
    console.log("Sin datos SEED_ADMIN_*: no se crea ningún usuario inicial.");
    return;
  }
  const existe = await db.usuario.findUnique({ where: { email } });
  if (existe && process.env.SEED_ADMIN_RESET === "si") {
    // Restablecimiento de emergencia: nueva contraseña, vuelve a ser dueño y queda activo.
    await db.usuario.update({
      where: { email },
      data: { passwordHash: await bcrypt.hash(password, 12), rol: "DUENO", activo: true, nombre },
    });
    console.log(`Contraseña restablecida para ${email}. Borrá SEED_ADMIN_RESET y SEED_ADMIN_PASSWORD.`);
    return;
  }
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
