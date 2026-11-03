import "server-only";
import { db } from "@/lib/db";
import { importeVigente } from "@/lib/cuenta";
import { aFecha, deFecha, esFechaValida, sumarDias } from "@/lib/fechas";
import { bultosDe, focacciasDe, totalUnidades, unidadesPorSabor } from "@/lib/ruta";

// Herramienta "ventas" del asistente: las cuentas de plata, paquetes y unidades las hace el sistema con las MISMAS reglas que las pantallas
// (Estadísticas, Semana), así la IA no inventa ni se equivoca en las cuentas. La IA solo elige el período, el criterio y el cliente.

export type EntradaVentas = {
  desde: string; hasta: string; // AAAA-MM-DD, inclusive
  origen?: "MAYORISTA" | "WEB" | "TODOS";
  criterio?: "entregado" | "cargado"; // entregado = pedidos ENTREGADOS por su día de entrega; cargado = todos los pedidos cargados (no cancelados) por el día en que se cargaron
  cliente?: string; // parte del nombre (mayorista: cliente, razón social o sucursal; tienda: nombre del comprador)
  detalle?: boolean; // lista de pedidos
};

const fechaAR = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
const r2 = (n: number) => Math.round(n * 100) / 100;

export async function ventas(e: EntradaVentas, conPlata: boolean) {
  if (!esFechaValida(e.desde) || !esFechaValida(e.hasta)) return { error: "Las fechas tienen que ser AAAA-MM-DD." };
  if (e.desde > e.hasta) return { error: "'desde' no puede ser posterior a 'hasta'." };
  if (e.hasta > sumarDias(e.desde, 400)) return { error: "El período es demasiado largo (máximo 400 días)." };
  const origen = e.origen ?? "TODOS";
  const criterio = e.criterio ?? "entregado";
  const texto = e.cliente?.trim();

  // Ventana ancha en UTC (se afina por día de Argentina más abajo).
  const ini = new Date(`${sumarDias(e.desde, -1)}T00:00:00Z`);
  const fin = new Date(`${sumarDias(e.hasta, 2)}T00:00:00Z`);
  const porNombre = texto
    ? [{ cliente: { nombre: { contains: texto, mode: "insensitive" as const } } }, { cliente: { razonSocial: { contains: texto, mode: "insensitive" as const } } }, { punto: { razonSocial: { contains: texto, mode: "insensitive" as const } } }, { webNombre: { contains: texto, mode: "insensitive" as const } }]
    : [];
  const pedidos = await db.pedido.findMany({
    where: {
      origen: origen === "TODOS" ? { in: ["MAYORISTA", "WEB"] } : origen,
      estado: criterio === "entregado" ? "ENTREGADO" : { notIn: ["CANCELADO"] },
      OR: [{ creadoEn: { gte: ini, lt: fin } }, { fechaEntrega: { gte: aFecha(e.desde), lte: aFecha(e.hasta) } }],
      ...(porNombre.length ? { AND: [{ OR: porNombre }] } : {}),
    },
    include: { items: true, cliente: { select: { nombre: true } }, punto: { select: { barrio: true } } },
    orderBy: { creadoEn: "asc" },
  });

  // Día de cada pedido según el criterio (igual que Estadísticas: lo entregado cuenta en su día de entrega; sin día, el de carga).
  const filas = pedidos
    .map((p) => ({ p, dia: criterio === "entregado" ? (p.fechaEntrega ? deFecha(p.fechaEntrega) : fechaAR(p.creadoEn)) : fechaAR(p.creadoEn) }))
    .filter((x) => x.dia >= e.desde && x.dia <= e.hasta);

  const calc = filas.map(({ p, dia }) => {
    const sabores = unidadesPorSabor(p.items);
    return {
      dia,
      quien: p.cliente?.nombre ?? (p.webNombre ? `${p.webNombre} (tienda${p.webOrden ? ` #${p.webOrden}` : ""})` : "—"),
      barrio: p.punto?.barrio ?? p.webBarrio ?? "",
      estado: p.estado,
      plata: importeVigente(p.items, Number(p.ivaPct), p.estado, p.webTotal),
      paquetes: bultosDe(p.items),
      pizzas: totalUnidades(sabores),
      focaccias: focacciasDe(p.items),
    };
  });

  const suma = (f: (x: (typeof calc)[number]) => number) => calc.reduce((t, x) => t + f(x), 0);
  const porDia = new Map<string, { pedidos: number; plata: number }>();
  for (const x of calc) { const d = porDia.get(x.dia) ?? { pedidos: 0, plata: 0 }; d.pedidos++; d.plata += x.plata; porDia.set(x.dia, d); }

  return {
    criterio: criterio === "entregado" ? "pedidos ENTREGADOS, en su día de entrega" : "pedidos CARGADOS (no cancelados), en el día en que se cargaron",
    desde: e.desde, hasta: e.hasta, origen,
    cliente_buscado: texto ?? null,
    nombres_que_coinciden: texto ? [...new Set(calc.map((x) => x.quien.replace(/ \(tienda.*$/, "")))].slice(0, 15) : undefined,
    pedidos: calc.length,
    plata_total_pesos: conPlata ? r2(suma((x) => x.plata)) : "BLOQUEADO (falta la contraseña de Estadísticas)",
    paquetes: r2(suma((x) => x.paquetes)),
    unidades_de_pizza_y_prepizza: suma((x) => x.pizzas),
    focaccias: suma((x) => x.focaccias),
    por_dia: [...porDia.entries()].sort().map(([dia, d]) => ({ dia, pedidos: d.pedidos, ...(conPlata ? { plata_pesos: r2(d.plata) } : {}) })),
    ...(e.detalle ? { pedidos_detalle: calc.slice(0, 40).map((x) => ({ dia: x.dia, quien: x.quien, barrio: x.barrio, estado: x.estado, paquetes: r2(x.paquetes), ...(conPlata ? { plata_pesos: r2(x.plata) } : {}) })), hay_mas: calc.length > 40 } : {}),
  };
}
