import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { hoy, sumarDias } from "@/lib/fechas";
import { bultosDe } from "@/lib/ruta";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../pedidos/Encabezado";
import { Tablero, type FilaCliente } from "./Tablero";

const dias = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
const fechaAR = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }); // AAAA-MM-DD

// COMERCIAL: tablero general de clientes. Quién pide, quién dejó de pedir, cuánto compra cada uno y cómo viene el mes.
// Todo sale de los pedidos ya cargados (no cancelados): no cambia nada, solo se mira.
export default async function Comercial() {
  const usuario = await exigirOficina();
  const hoyStr = hoy();
  const mesActual = hoyStr.slice(0, 7);
  const primeroMes = `${mesActual}-01`;
  const ultimoMesAnt = sumarDias(primeroMes, -1);
  const mesAnterior = ultimoMesAnt.slice(0, 7);

  const [clientes, pedidos] = await Promise.all([
    db.cliente.findMany({ where: { activo: true }, include: { puntos: { where: { activo: true }, select: { barrio: true } } }, orderBy: { nombre: "asc" } }),
    db.pedido.findMany({ where: { clienteId: { not: null }, estado: { not: "CANCELADO" }, origen: "MAYORISTA" }, include: { items: true }, orderBy: { creadoEn: "asc" } }),
  ]);

  type Acum = { fechas: string[]; paqMes: number; paqAnt: number; ped90: number; paq90: number };
  const porCliente = new Map<string, Acum>();
  const hace90 = sumarDias(hoyStr, -90), hace180 = sumarDias(hoyStr, -180);
  for (const p of pedidos) {
    if (p.estado === "NO_ENTREGADO") continue; // no llegó a entregarse: no cuenta como compra
    const f = fechaAR(p.creadoEn);
    const a = porCliente.get(p.clienteId!) ?? { fechas: [], paqMes: 0, paqAnt: 0, ped90: 0, paq90: 0 };
    const paq = bultosDe(p.items);
    a.fechas.push(f);
    if (f.startsWith(mesActual)) { a.paqMes += paq; }
    else if (f.startsWith(mesAnterior)) { a.paqAnt += paq; }
    if (f >= hace90) { a.ped90 += 1; a.paq90 += paq; }
    porCliente.set(p.clienteId!, a);
  }

  const filas: FilaCliente[] = clientes.map((c) => {
    const a = porCliente.get(c.id);
    const fechas = a?.fechas ?? [];
    const ultimo = fechas.length ? fechas[fechas.length - 1] : null;
    // Ritmo habitual: cada cuántos días suele pedir (pedidos de los últimos 180 días, un día = un pedido).
    const recientes = [...new Set(fechas.filter((f) => f >= hace180))];
    const ritmo = recientes.length >= 3 ? Math.round(dias(recientes[recientes.length - 1], recientes[0]) / (recientes.length - 1)) : null;
    const sinPedir = ultimo ? dias(hoyStr, ultimo) : null;
    return {
      id: c.id, nombre: c.nombre, barrios: [...new Set(c.puntos.map((p) => p.barrio).filter(Boolean))].slice(0, 2).join(" · "),
      ultimo, sinPedir, ritmo, atrasado: ritmo !== null && sinPedir !== null && sinPedir > Math.max(ritmo * 1.5, ritmo + 3),
      ped90: a?.ped90 ?? 0, paqMes: a?.paqMes ?? 0, paqAnt: a?.paqAnt ?? 0,
      paqProm: (a?.paq90 ?? 0) / 3, total: fechas.length,
    };
  });

  const resumen = {
    activos: filas.length,
    pidieron30: filas.filter((f) => f.sinPedir !== null && f.sinPedir <= 30).length,
    sin30: filas.filter((f) => f.sinPedir !== null && f.sinPedir > 30).length,
    nunca: filas.filter((f) => f.ultimo === null).length,
    atrasados: filas.filter((f) => f.atrasado).length,
    paqMes: filas.reduce((s, f) => s + f.paqMes, 0), paqAnt: filas.reduce((s, f) => s + f.paqAnt, 0),
  };

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Comercial</h1>
        </div>
        <Tablero filas={filas} resumen={resumen} mes={mesActual} />
      </main>
    </>
  );
}
