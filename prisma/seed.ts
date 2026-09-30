import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

// Crea el primer dueño a partir de variables de entorno. No pisa usuarios existentes.
const db = new PrismaClient();

// Datos base: se crean solo si faltan, sin pisar lo que ya se cambió a mano.
async function datosBase() {
  for (const [orden, nombre] of ["Norte", "Oeste", "Sur", "CABA"].entries()) {
    await db.zona.upsert({ where: { nombre }, update: {}, create: { nombre, orden } });
  }
  // Solo en una instalación nueva. En una base ya en uso, el catálogo inicial lo carga la migración "catalogo".
  if ((await db.listaPrecios.count()) === 0) {
    await db.listaPrecios.createMany({ data: [{ nombre: "Mayorista" }, { nombre: "Distribuidor" }, { nombre: "VACALIN" }] });
  }
  if ((await db.producto.count()) === 0) {
    await db.producto.createMany({
      data: [
        { nombre: "Prepizza tomate", sku: "PPT01", unidad: "paquete", descripcion: "Prepizza de tomate x 2 un" },
        { nombre: "Prepizza cebolla", sku: "PPC02", unidad: "paquete", descripcion: "Prepizza de cebolla x 2 un" },
        { nombre: "Pizzeta tomate", sku: "PZT03", unidad: "paquete", descripcion: "Pizzeta de tomate x 6 un" },
        { nombre: "Focaccia oliva", sku: "FOO04", unidad: "unidad", descripcion: "Focaccia de oliva" },
        { nombre: "Pizza congelada muzzarella", sku: "PCM05", unidad: "unidad", descripcion: "Pizza congelada de muzzarella" },
        { nombre: "Pizza congelada jamón", sku: "PCJ06", unidad: "unidad", descripcion: "Pizza congelada de jamón" },
        { nombre: "Pizza congelada fugazzeta", sku: "PCF07", unidad: "unidad", descripcion: "Pizza congelada fugazzeta" },
      ],
    });
  }
}

async function main() {
  await datosBase();
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
