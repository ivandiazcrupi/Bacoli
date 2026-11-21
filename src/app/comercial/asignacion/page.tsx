import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import { clientesConVendedor, vendedoresConConteo } from "./datos";

// ASIGNACIÓN DE CLIENTES (pantalla momentánea): todos los clientes y de quién son (de la fábrica, de un vendedor…), cliente por cliente,
// para repartir los de un vendedor que dejó de trabajar y sacar el PDF de su lista. Solo mira datos: no cambia nada.
export default async function Asignacion({ searchParams }: { searchParams: Promise<{ v?: string; q?: string; inactivos?: string }> }) {
  const usuario = await exigirOficina();
  const { v = "todos", q = "", inactivos } = await searchParams;
  const conInactivos = inactivos === "1";
  const [filas, resumen] = await Promise.all([clientesConVendedor(v, q, conInactivos), vendedoresConConteo(conInactivos)]);

  const href = (nuevo: string) => `/comercial/asignacion?v=${encodeURIComponent(nuevo)}${q ? `&q=${encodeURIComponent(q)}` : ""}${conInactivos ? "&inactivos=1" : ""}`;
  const chip = (id: string, texto: string, n: number) => (
    <Link key={id} href={href(id)} aria-current={v === id ? "true" : undefined} className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${v === id ? "border-stone-800 bg-stone-800 text-white" : "border-stone-300 bg-white text-stone-700 hover:border-stone-600"}`}>
      {texto} <span className={v === id ? "text-stone-300" : "text-stone-400"}>{n}</span>
    </Link>
  );
  const nombreLista = v === "todos" ? "todos los clientes" : v === "fabrica" ? "los clientes de la fábrica" : `los clientes de ${resumen.vendedores.find((x) => x.id === v)?.nombre ?? "—"}`;
  const imprimir = `/comercial/asignacion/imprimir?v=${encodeURIComponent(v)}${q ? `&q=${encodeURIComponent(q)}` : ""}${conInactivos ? "&inactivos=1" : ""}`;

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Asignación de clientes</h1>
            <p className="mt-1 text-[13px] text-stone-500">Pantalla momentánea: cada cliente y quién lo atiende. Solo mira, no cambia nada. Para pasar clientes de un vendedor a otro: Comercial → Vendedores → “Asignar clientes”.</p>
          </div>
          <Link href="/comercial" className="text-[13px] font-semibold text-stone-600 underline-offset-2 hover:underline">← Volver a Comercial</Link>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Quién los atiende">
          {chip("todos", "Todos", resumen.total)}
          {chip("fabrica", "De la fábrica (sin vendedor)", resumen.sinVendedor)}
          {resumen.vendedores.map((x) => chip(x.id, `${x.nombre}${x.activo ? "" : " (de baja)"}`, x.clientes))}
        </div>

        <form action="/comercial/asignacion" className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="v" value={v} />
          <input name="q" defaultValue={q} placeholder="Buscar cliente o barrio…" aria-label="Buscar" className="h-10 w-full max-w-xs rounded-md border border-stone-300 bg-white px-3 text-sm focus:border-verde-700 focus:outline-none" />
          <label className="flex items-center gap-2 text-[13px] text-stone-600"><input type="checkbox" name="inactivos" value="1" defaultChecked={conInactivos} /> Incluir desactivados</label>
          <button className="h-10 rounded-md border border-stone-300 bg-white px-4 text-sm font-semibold hover:border-stone-600">Buscar</button>
          <span className="flex-1" />
          <span className="text-[14px] text-stone-700">{filas.length} {filas.length === 1 ? "cliente" : "clientes"}</span>
          <Link href={imprimir} target="_blank" className="h-10 rounded-md bg-verde-700 px-4 text-sm font-semibold leading-10 text-white hover:bg-verde-800">PDF de {nombreLista} ›</Link>
        </form>

        <div className="overflow-x-auto rounded-lg border border-stone-300 bg-white">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead className="bg-crema-100 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              <tr><th className="w-12 px-3 py-2.5 text-right">N°</th><th className="px-3 py-2.5 text-left">Cliente</th><th className="px-3 py-2.5 text-left">Sucursales (barrio · dirección)</th><th className="px-3 py-2.5 text-left">Teléfono</th><th className="px-3 py-2.5 text-center">Quién lo atiende</th></tr>
            </thead>
            <tbody>
              {filas.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-stone-500">No hay clientes con ese filtro.</td></tr>}
              {filas.map((f, i) => (
                <tr key={f.id} className={`border-t border-stone-200 align-top hover:bg-crema-50 ${f.activo ? "" : "text-stone-400"}`}>
                  <td className="px-3 py-2.5 text-right tabular-nums text-stone-400">{i + 1}</td>
                  <td className="px-3 py-2.5 font-semibold"><Link href={`/clientes/${f.id}`} className="hover:underline">{f.nombre}</Link>{!f.activo && <span className="ml-2 text-[11px] font-normal">desactivado</span>}</td>
                  <td className="px-3 py-2.5 leading-snug">{f.sucursales.length === 0 ? <span className="text-stone-300">—</span> : f.sucursales.map((s, k) => <div key={k}><b className="font-semibold">{s.barrio}</b> · {s.direccion}</div>)}</td>
                  <td className="px-3 py-2.5 tabular-nums">{f.telefonos.length === 0 ? <span className="text-stone-300">—</span> : f.telefonos.map((t) => <div key={t}>{t}</div>)}</td>
                  <td className="px-3 py-2.5 text-center"><span className={`inline-block rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${f.vendedorId ? "bg-stone-800 text-white" : "border border-stone-300 bg-crema-100 text-stone-700"}`}>{f.vendedor}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
