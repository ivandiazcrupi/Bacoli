import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

// Qué tablas puede leer el asistente. Tiene que coincidir con los permisos del usuario de solo lectura (docs/ASISTENTE.md).
// Nunca van Usuario (contraseñas) ni Empresa (contraseña de totales), ni los precios por lista ni las asignaciones de comisión.
export const TABLAS_PERMITIDAS = [
  "Cliente", "PuntoEntrega", "Zona", "Producto", "Pedido", "PedidoItem", "MovimientoCuenta",
  "NotaCredito", "NotaCreditoAplicacion", "ComprobanteArca", "AplicacionNcArca",
  "Vehiculo", "Salida", "IntentoEntrega", "DiaCerrado", "DiaListo", "Vendedor", "Lead", "LeadContacto", "Produccion",
];

let cache: string | null = null;

/** Las tablas permitidas, copiadas del esquema real de la base (así nunca queda desactualizado). */
export function esquemaPermitido(): string {
  if (cache) return cache;
  const texto = readFileSync(path.join(process.cwd(), "prisma", "schema.prisma"), "utf8");
  const bloques = texto.match(/^(model|enum) \w+ \{[\s\S]*?^\}/gm) ?? [];
  const usadas: string[] = [];
  for (const b of bloques) {
    const nombre = b.match(/^(model|enum) (\w+)/)![2];
    if (b.startsWith("model") && !TABLAS_PERMITIDAS.includes(nombre)) continue;
    usadas.push(b.split("\n").filter((l) => !l.trim().startsWith("@@index") && !l.trim().startsWith("@@unique")).join("\n"));
  }
  cache = usadas.join("\n\n");
  return cache;
}
