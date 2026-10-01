import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Cabecera } from "@/components/Cabecera";
import { cabeceraTabla } from "@/components/campos";
import { importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { deFecha, diaMes, nombreDia } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { PestanasPedidos } from "./Pestanas";

const LIMITE = 300;
const ESTADO = {
  PENDIENTE: { texto: "Pendiente", clase: "bg-crema-200 text-verde-900" },
  ENTREGADO: { texto: "Entregado", clase: "bg-verde-100 text-verde-800" },
  NO_ENTREGADO: { texto: "No entregado", clase: "bg-rojo-100 text-rojo-800" },
  CANCELADO: { texto: "Cancelado", clase: "bg-stone-200 text-stone-600" },
} as const;

const FILTROS = {
  pendientes: { texto: "Pendientes", where: { estado: "PENDIENTE" } },
  sinasignar: { texto: "Sin asignar", where: { estado: "PENDIENTE", fechaEntrega: null } },
  entregados: { texto: "Entregados", where: { estado: "ENTREGADO" } },
  todos: { texto: "Todos", where: {} },
} satisfies Record<string, { texto: string; where: Prisma.PedidoWhereInput }>;
type Filtro = keyof typeof FILTROS;

const COLUMNAS = "lg:grid-cols-[1.2fr_1.8fr_3fr_8rem_8rem_8rem_6rem]";

// Pedidos cargados: solo la lista, sin armar rutas. La hoja de ruta (asignar a un día, repartir) está en la otra pestaña.
export default async function Pedidos({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const usuario = await exigirOficina();
  const { ver } = await searchParams;
  const filtro: Filtro = ver && ver in FILTROS ? (ver as Filtro) : "pendientes";

  const claves = Object.keys(FILTROS) as Filtro[];
  const [pedidos, ...cuentas] = await Promise.all([
    db.pedido.findMany({
      where: FILTROS[filtro].where,
      include: { cliente: true, punto: true, items: { orderBy: { producto: { orden: "asc" } } } },
      orderBy: [{ fechaEntrega: { sort: "asc", nulls: "first" } }, { creadoEn: "desc" }],
      take: LIMITE,
    }),
    ...claves.map((k) => db.pedido.count({ where: FILTROS[k].where })),
  ]);
  const cuenta = Object.fromEntries(claves.map((k, i) => [k, cuentas[i]])) as Record<Filtro, number>;

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <Link href="/pedidos/nuevo" className="whitespace-nowrap rounded-lg bg-verde-700 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-verde-800 sm:px-10">+ Cargar pedido</Link>
        </div>
        <PestanasPedidos activa="cargados" />

        <div className="flex flex-wrap items-center gap-2">
          {claves.map((k) => (
            <Link
              key={k}
              href={k === "pendientes" ? "/pedidos" : `/pedidos?ver=${k}`}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${k === filtro ? "bg-verde-700 text-white shadow-sm" : "border border-stone-400 bg-white text-stone-700 hover:border-verde-700 hover:text-verde-800"}`}
            >
              {FILTROS[k].texto} <span className={k === filtro ? "text-verde-100" : "text-stone-500"}>{cuenta[k]}</span>
            </Link>
          ))}
        </div>

        {pedidos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-400 p-6 text-center text-stone-600">No hay pedidos en esta vista.</p>
        ) : (
          <div className="space-y-2">
            <div className={`hidden gap-x-4 rounded-t-xl px-4 py-3 lg:grid ${cabeceraTabla} ${COLUMNAS}`}>
              <span>Barrio</span><span>Cliente</span><span>Pedido</span><span className="text-right">Monto</span><span>Día</span><span>Estado</span><span />
            </div>
            {pedidos.map((p) => {
              const fecha = p.fechaEntrega ? deFecha(p.fechaEntrega) : null;
              const monto = importeVigente(p.items, Number(p.ivaPct), p.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE");
              const est = ESTADO[p.estado];
              const resumen = p.items.map((i) => `${p.estado === "ENTREGADO" ? (i.cantidadEntregada ?? i.cantidad) : i.cantidad} ${i.nombre}`).join(" · ");
              return (
                <Link key={p.id} href={`/pedidos/${p.id}`} className={`grid items-center gap-x-4 gap-y-1 rounded-xl border border-stone-300 bg-white px-4 py-3 shadow-sm hover:border-verde-700 ${COLUMNAS}`}>
                  <span className="text-sm font-semibold">{p.punto.barrio}</span>
                  <span className="text-sm font-semibold">{p.cliente.nombre}</span>
                  <span className="text-sm leading-snug text-stone-700">{resumen}</span>
                  <span className="text-sm font-semibold tabular-nums lg:text-right">{formatoPesos(monto)}</span>
                  <span className="text-sm">{fecha ? `${nombreDia(fecha).slice(0, 3)} ${diaMes(fecha)}` : <span className="rounded-full bg-rojo-100 px-2.5 py-0.5 text-xs font-semibold text-rojo-800">Sin asignar</span>}</span>
                  <span><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${est.clase}`}>{est.texto}</span></span>
                  <span className="text-sm font-medium text-verde-800 lg:text-right">Abrir →</span>
                </Link>
              );
            })}
            {cuenta[filtro] > LIMITE && <p className="text-center text-sm text-stone-500">Se muestran los primeros {LIMITE} de {cuenta[filtro]}.</p>}
          </div>
        )}
      </main>
    </>
  );
}
