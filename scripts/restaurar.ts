// Restaura una copia de seguridad (archivo .json bajado desde Empresa → Copia de seguridad) en una base VACÍA.
// Uso:  DATABASE_URL=... npx tsx scripts/restaurar.ts bacoli-copia-AAAA-MM-DD_HHMM.json
// No pisa datos: si la base ya tiene datos, se frena.
import { readFileSync } from "node:fs";
import { Prisma, PrismaClient } from "@prisma/client";

const archivo = process.argv[2];
if (!archivo) { console.error("Falta el archivo de la copia."); process.exit(1); }
const copia = JSON.parse(readFileSync(archivo, "utf8")) as { sistema: string; tablas: Record<string, Record<string, unknown>[]> };
if (copia.sistema !== "BACOLI") { console.error("Ese archivo no es una copia de BACOLI."); process.exit(1); }

const db = new PrismaClient();
const modelos = Prisma.dmmf.datamodel.models;
const minuscula1 = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// Orden de carga: primero las tablas de las que dependen las otras.
function ordenar() {
  const listo: string[] = [];
  const pendientes = new Set(modelos.map((m) => m.name));
  while (pendientes.size) {
    const antes = pendientes.size;
    for (const nombre of [...pendientes]) {
      const m = modelos.find((x) => x.name === nombre)!;
      const deps = m.fields.filter((f) => f.kind === "object" && (f.relationFromFields?.length ?? 0) > 0).map((f) => f.type).filter((t) => t !== nombre);
      if (deps.every((d) => listo.includes(d))) { listo.push(nombre); pendientes.delete(nombre); }
    }
    if (pendientes.size === antes) { listo.push(...pendientes); break; }
  }
  return listo;
}

function convertir(nombre: string, fila: Record<string, unknown>) {
  const m = modelos.find((x) => x.name === nombre)!;
  const salida: Record<string, unknown> = { ...fila };
  for (const f of m.fields) {
    if (f.kind !== "scalar" || salida[f.name] == null) continue;
    if (f.type === "DateTime") salida[f.name] = new Date(String(salida[f.name]));
    if (f.type === "Json") salida[f.name] = salida[f.name] as Prisma.InputJsonValue;
  }
  return salida;
}

async function main() {
  // Se frena si hay trabajo real cargado: solo se restaura en una base nueva (la que sale de las migraciones tiene datos base, eso no cuenta).
  for (const m of ["Pedido", "Cliente", "MovimientoCuenta"]) {
    const n = await (db as unknown as Record<string, { count: () => Promise<number> }>)[minuscula1(m)].count();
    if (n > 0) {
      console.error(`La base ya tiene datos de trabajo (${m}: ${n}). Restaurá solo en una base nueva.`);
      process.exit(1);
    }
  }
  // Se vacían los datos base que se crean solos (zonas, listas, productos, usuario inicial…) y se cargan los de la copia.
  const tablas = modelos.map((m) => `"${m.dbName ?? m.name}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tablas} RESTART IDENTITY CASCADE`);
  for (const nombre of ordenar()) {
    const filas = copia.tablas[nombre] ?? [];
    if (filas.length === 0) continue;
    const delegado = (db as unknown as Record<string, { createMany: (a: { data: unknown[] }) => Promise<{ count: number }> }>)[minuscula1(nombre)];
    for (let i = 0; i < filas.length; i += 500) {
      await delegado.createMany({ data: filas.slice(i, i + 500).map((f) => convertir(nombre, f)) });
    }
    console.log(`${nombre}: ${filas.length}`);
  }
  console.log("Listo: copia restaurada.");
}
main().finally(() => db.$disconnect());
