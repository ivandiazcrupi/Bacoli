import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { hoy, sumarDias } from "@/lib/fechas";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../pedidos/Encabezado";
import { Tablero, type FilaCliente } from "./Tablero";

const dias = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
const fechaAR = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }); // AAAA-MM-DD

// COMERCIAL: tablero general de clientes. Quién pide, quién dejó de pedir, qué clientes llevan tiempo sin pedir.
// Todo sale de los pedidos ya cargados (no cancelados): no cambia nada, solo se mira.
export default async function Comercial() {
  const usuario = await exigirOficina();
  const hoyStr = hoy();

  const [clientes, pedidos] = await Promise.all([
    db.cliente.findMany({ where: { activo: true }, include: { puntos: { where: { activo: true }, select: { barrio: true } } }, orderBy: { nombre: "asc" } }),
    db.pedido.findMany({ where: { clienteId: { not: null }, estado: { not: "CANCELADO" }, origen: "MAYORISTA" }, select: { clienteId: true, estado: true, creadoEn: true }, orderBy: { creadoEn: "asc" } }),
  ]);

  type Acum = { fechas: string[]; ped90: number };
  const porCliente = new Map<string, Acum>();
  const hace90 = sumarDias(hoyStr, -90);
  for (const p of pedidos) {
    if (p.estado === "NO_ENTREGADO") continue; // no llegó a entregarse: no cuenta como compra
    const f = fechaAR(p.creadoEn);
    const a = porCliente.get(p.clienteId!) ?? { fechas: [], ped90: 0 };
    a.fechas.push(f);
    if (f >= hace90) a.ped90 += 1;
    porCliente.set(p.clienteId!, a);
  }

  const filas: FilaCliente[] = clientes.map((c) => {
    const a = porCliente.get(c.id);
    const fechas = a?.fechas ?? [];
    const ultimo = fechas.length ? fechas[fechas.length - 1] : null;
    const sinPedir = ultimo ? dias(hoyStr, ultimo) : null; // días desde su último pedido (null = nunca pidió)
    return {
      id: c.id, nombre: c.nombre, barrios: [...new Set(c.puntos.map((p) => p.barrio).filter(Boolean))].slice(0, 2).join(" · "),
      ultimo, sinPedir,
      ped90: a?.ped90 ?? 0, total: fechas.length,
    };
  });

  const mas = (n: number) => filas.filter((f) => f.sinPedir !== null && f.sinPedir > n).length; // acumulado: n días o más sin pedir
  const resumen = {
    activos: filas.length,
    d7: filas.filter((f) => f.sinPedir !== null && f.sinPedir <= 7).length,
    sin7: mas(7), sin15: mas(15), sin30: mas(30), sin45: mas(45),
    inactivos: filas.filter((f) => f.ultimo === null).length,
  };

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Comercial</h1>
        </div>
        <Tablero filas={filas} resumen={resumen} />
      </main>
    </>
  );
}
