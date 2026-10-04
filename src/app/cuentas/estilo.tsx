import Link from "next/link";

// Un solo aspecto para las tres pestañas de CUENTA CORRIENTE (Facturas, Remitos, Clientes): que no se vean distintas.
export const CONTENEDOR_TABLA = "overflow-hidden rounded-lg border border-stone-300 bg-white";
export const CABECERA_TABLA = "items-center gap-x-4 border-b border-stone-300 bg-crema-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500";
export const FILA_TABLA = "items-center gap-x-4 border-b border-stone-200 px-4 py-2.5 text-[13.5px] text-stone-800 hover:bg-crema-50";

export function Resumen({ datos }: { datos: { titulo: string; valor: React.ReactNode; rojo?: boolean }[] }) {
  return (
    <section aria-label="Resumen" className="grid grid-cols-2 divide-x divide-stone-200 overflow-hidden rounded-lg border border-stone-300 bg-white sm:grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
      {datos.map((d) => (
        <div key={d.titulo} className="px-4 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{d.titulo}</p>
          <p className={`text-lg font-bold tabular-nums ${d.rojo ? "text-rojo-700" : "text-stone-900"}`}>{d.valor}</p>
        </div>
      ))}
    </section>
  );
}

/** Buscador y, si se pasa, los botones Todas / Pendientes / Pagadas. */
export function BarraFiltros({ q, placeholder, estado, ruta, derecha }: { q: string; placeholder: string; estado?: string; ruta?: string; derecha: React.ReactNode }) {
  return (
    <form className="flex flex-wrap items-center gap-2">
      <input name="q" defaultValue={q} placeholder={placeholder} className="h-9 w-full max-w-sm rounded-md border border-stone-300 bg-white px-3 text-sm focus:border-stone-500 focus:outline-none" />
      {estado !== undefined && <input type="hidden" name="estado" value={estado} />}
      {estado !== undefined && ruta && (
        <div role="group" aria-label="Mostrar" className="inline-flex overflow-hidden rounded-md border border-stone-300 bg-white text-sm">
          {([["todas", "Todas"], ["sin-pagar", "Pendientes de pago"], ["pagadas", "Pagadas"]] as const).map(([v, t]) => (
            <Link key={v} href={`${ruta}?${new URLSearchParams({ ...(q ? { q } : {}), estado: v })}`} aria-current={estado === v ? "true" : undefined} className={`h-9 px-4 leading-9 ${estado === v ? "bg-stone-800 font-semibold text-white" : "text-stone-600 hover:bg-crema-100"}`}>{t}</Link>
          ))}
        </div>
      )}
      <button className="h-9 rounded-md border border-stone-300 bg-white px-4 text-sm hover:border-stone-500">Buscar</button>
      <span className="ml-auto text-[13px] text-stone-500">{derecha}</span>
    </form>
  );
}
