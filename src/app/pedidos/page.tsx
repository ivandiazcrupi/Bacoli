import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { aFecha, deFecha, diaMes, esFechaValida, hoy, lunesDe, nombreDia, sumarDias } from "@/lib/fechas";
import { exigirOficina } from "@/lib/session";
import { Bandeja } from "./Bandeja";
import { aFilaBandeja, incluirPedido } from "./filas";
import { PestanasPedidos } from "./Pestanas";

// PEDIDOS: todo lo cargado que espera día (como la hoja PEDIDOS de la planilla). Mayoristas y minoristas de la web van en dos listas.
export default async function Pedidos({ searchParams }: { searchParams: Promise<{ lista?: string; semana?: string }> }) {
  const usuario = await exigirOficina();
  const { lista, semana } = await searchParams;
  const esWeb = lista === "web";
  const lunes = lunesDe(semana && esFechaValida(semana) ? semana : hoy());
  const domingo = sumarDias(lunes, 6);
  const esta = lunesDe(hoy());

  const esperando = { estado: "PENDIENTE", fechaEntrega: null } as const;
  const [pedidos, cuentaMayoristas, cuentaWeb, cerrados] = await Promise.all([
    db.pedido.findMany({ where: { ...esperando, origen: esWeb ? "WEB" : "MAYORISTA" }, include: incluirPedido, orderBy: [{ creadoEn: "asc" }] }),
    db.pedido.count({ where: { ...esperando, origen: "MAYORISTA" } }),
    db.pedido.count({ where: { ...esperando, origen: "WEB" } }),
    db.diaCerrado.findMany({ where: { fecha: { gte: aFecha(lunes), lte: aFecha(domingo) } } }),
  ]);
  const cerradosSet = new Set(cerrados.map((d) => deFecha(d.fecha)));
  const dias = Array.from({ length: 6 }, (_, n) => sumarDias(lunes, n)).map((f) => ({ fecha: f, corta: nombreDia(f).slice(0, 3), hoy: f === hoy(), cerrado: cerradosSet.has(f) }));

  const enlace = (extra: Record<string, string>) => {
    const v: Record<string, string> = { ...(esWeb ? { lista: "web" } : {}), ...(semana ? { semana } : {}), ...extra };
    const q = new URLSearchParams(Object.entries(v).filter(([, x]) => x));
    return `/pedidos${q.size ? `?${q}` : ""}`;
  };
  const pastilla = "rounded-full px-5 py-2 text-sm font-semibold transition";

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <Link href="/pedidos/nuevo" className="whitespace-nowrap rounded-lg bg-verde-700 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-verde-800 sm:px-10">+ Cargar pedido</Link>
        </div>
        <PestanasPedidos activa="pedidos" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Link href={enlace({ lista: "" })} className={`${pastilla} ${!esWeb ? "bg-verde-700 text-white shadow-sm" : "border border-stone-400 bg-white text-stone-700 hover:border-verde-700"}`}>Mayoristas <span className={!esWeb ? "text-verde-100" : "text-stone-500"}>{cuentaMayoristas}</span></Link>
            <Link href={enlace({ lista: "web" })} className={`${pastilla} ${esWeb ? "bg-verde-700 text-white shadow-sm" : "border border-stone-400 bg-white text-stone-700 hover:border-verde-700"}`}>Minoristas (web) <span className={esWeb ? "text-verde-100" : "text-stone-500"}>{cuentaWeb}</span></Link>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Semana en la que se asigna">
            <span className="text-stone-600">Asignar a la semana:</span>
            <Link href={enlace({ semana: sumarDias(lunes, -7) })} className="rounded-md border border-stone-400 bg-white px-3 py-2 shadow-sm" aria-label="Semana anterior">←</Link>
            <span className="min-w-28 text-center font-semibold">{diaMes(lunes)} al {diaMes(domingo)}</span>
            <Link href={enlace({ semana: sumarDias(lunes, 7) })} className="rounded-md border border-stone-400 bg-white px-3 py-2 shadow-sm" aria-label="Semana siguiente">→</Link>
            {lunes !== esta && <Link href={enlace({ semana: "" })} className="rounded-md border border-stone-400 bg-white px-3 py-2 shadow-sm">Esta semana</Link>}
          </nav>
        </div>

        {esWeb && pedidos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-400 p-8 text-center text-stone-600">Los pedidos de la tienda online van a aparecer acá apenas se conecte la web.</p>
        ) : (
          <Bandeja key={`${lunes}-${esWeb}`} filas={pedidos.map(aFilaBandeja)} dias={dias} />
        )}
      </main>
    </>
  );
}
