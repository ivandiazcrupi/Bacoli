import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { vendedoresDesbloqueado } from "@/lib/claveVendedores";
import { db } from "@/lib/db";
import { esFechaValida, hoy } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { mesAnterior, mesSiguiente, nombreMes, ventasEntregadas } from "@/lib/vendedores";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import { EncabezadoComercial } from "../EncabezadoComercial";
import { PantallaBloqueada } from "./Bloqueo";
import { BotonImportar, BotonSalir, CambiarClave } from "./Formularios";

const nav = "flex h-9 items-center rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold hover:border-stone-600";

// VENDEDORES: quién comisiona, cuánto vendió y cuánto le toca este mes. Se entra con la contraseña del apartado.
export default async function Vendedores({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const usuario = await exigirOficina();
  if (!(await vendedoresDesbloqueado())) return <PantallaBloqueada usuario={usuario} />;
  const { mes: mesParam } = await searchParams;
  const actual = hoy().slice(0, 7);
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) && esFechaValida(`${mesParam}-01`) ? mesParam : actual;

  const [vendedores, ventas, conComisionista] = await Promise.all([
    db.vendedor.findMany({ orderBy: [{ activo: "desc" }, { nombre: "asc" }], include: { _count: { select: { clientes: true } } } }),
    ventasEntregadas(`${mes}-01`, `${mesSiguiente(mes)}-01`),
    db.cliente.findMany({ where: { comisionista: { not: null } }, select: { comisionista: true, comisionPct: true } }),
  ]);

  // Comisionistas que estaban escritos en las fichas de los clientes y todavía no son vendedores.
  const yaVendedor = new Set(vendedores.map((v) => v.nombre.trim().toLowerCase()));
  const grupos = new Map<string, { nombre: string; clientes: number; pct: number }>();
  for (const c of conComisionista) {
    const nombre = (c.comisionista ?? "").trim();
    if (!nombre || yaVendedor.has(nombre.toLowerCase())) continue;
    const g = grupos.get(nombre.toLowerCase()) ?? { nombre, clientes: 0, pct: 0 };
    g.clientes += 1; g.pct = Math.max(g.pct, Number(c.comisionPct ?? 0));
    grupos.set(nombre.toLowerCase(), g);
  }

  const filas = vendedores.map((v) => {
    const neto = ventas.filter((x) => x.vendedorId === v.id).reduce((t, x) => t + x.neto, 0);
    const pct = Number(v.comisionPct ?? 0);
    return { v, pct, neto, comision: (neto * pct) / 100 };
  });
  const total = filas.reduce((t, f) => t + f.comision, 0);

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={`${CONTENEDOR_PEDIDOS} space-y-6`}>
        <EncabezadoComercial
          activa="vendedores"
          derecha={
            <>
              <nav className="flex items-center gap-2" aria-label="Mes">
                <Link href={`/comercial/vendedores?mes=${mesAnterior(mes)}`} className={nav} aria-label="Mes anterior">←</Link>
                <span className="min-w-40 text-center text-sm font-semibold capitalize text-stone-700">{nombreMes(mes)}</span>
                <Link href={`/comercial/vendedores?mes=${mesSiguiente(mes)}`} className={nav} aria-label="Mes siguiente">→</Link>
              </nav>
              <Link href="/comercial/vendedores/nuevo" className="ml-2 flex h-10 items-center rounded-lg bg-stone-900 px-5 text-sm font-semibold text-white hover:bg-stone-700">+ Nuevo vendedor</Link>
            </>
          }
        />

        {[...grupos.values()].map((g) => <BotonImportar key={g.nombre} comisionista={g.nombre} clientes={g.clientes} pct={g.pct ? String(g.pct).replace(".", ",") : ""} />)}

        <section className="space-y-3">
          {filas.map(({ v, pct, neto, comision }) => (
            <Link key={v.id} href={`/comercial/vendedores/${v.id}?mes=${mes}`}
              className={`flex flex-wrap items-center justify-between gap-x-8 gap-y-2 rounded-xl border border-stone-200 bg-white px-6 py-5 transition hover:border-stone-400 ${v.activo ? "" : "opacity-55"}`}>
              <div>
                <p className="text-lg font-semibold">{v.nombre}{!v.activo && <span className="ml-3 rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-medium text-stone-600">de baja</span>}</p>
                <p className="text-sm text-stone-500">{v._count.clientes} {v._count.clientes === 1 ? "cliente" : "clientes"}{pct ? ` · ${String(pct).replace(".", ",")}%` : " · sin % cargado"}</p>
              </div>
              <div className="flex items-baseline gap-10 text-right">
                <div><p className="text-xs text-stone-400">Vendió</p><p className="text-lg tabular-nums text-stone-700">{formatoPesos(neto)}</p></div>
                <div><p className="text-xs text-stone-400">Comisión</p><p className="text-2xl font-semibold tabular-nums">{formatoPesos(comision)}</p></div>
              </div>
            </Link>
          ))}
          {filas.length === 0 && <p className="rounded-xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center text-stone-500">Todavía no hay vendedores. Con “+ Nuevo vendedor” cargás el primero.</p>}
        </section>

        {filas.length > 0 && (
          <p className="flex items-baseline justify-end gap-3 px-2 text-stone-600">Comisiones de {nombreMes(mes)} <span className="text-2xl font-semibold tabular-nums text-stone-900">{formatoPesos(total)}</span></p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-6 border-t border-stone-200 pt-4"><CambiarClave /><BotonSalir /></div>
      </main>
    </>
  );
}
