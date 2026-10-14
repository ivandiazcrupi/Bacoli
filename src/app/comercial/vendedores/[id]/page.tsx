import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { vendedoresDesbloqueado } from "@/lib/claveVendedores";
import { db } from "@/lib/db";
import { esFechaValida, hoy } from "@/lib/fechas";
import { exigirOficina } from "@/lib/session";
import { filasDelPeriodo, mesAnterior, mesSiguiente, nombreMes } from "@/lib/vendedores";
import { CONTENEDOR_PEDIDOS } from "../../../pedidos/Encabezado";
import { PantallaBloqueada } from "../Bloqueo";
import { AccionesVendedor, AsignarClientes, FormVendedor, UnirVendedor } from "../Formularios";
import { HojaVendedor } from "../HojaVendedor";

const nav = "flex h-9 items-center rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold hover:border-stone-600";

// Un vendedor, como la ficha de un cliente: sus datos para editar, cuánto vendió el mes y a quién.
export default async function FichaVendedor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string; unido?: string }> }) {
  const usuario = await exigirOficina();
  if (!(await vendedoresDesbloqueado())) return <PantallaBloqueada usuario={usuario} />;
  const { id } = await params;
  const { mes: mesParam, unido } = await searchParams;
  const actual = hoy().slice(0, 7);
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) && esFechaValida(`${mesParam}-01`) ? mesParam : actual;
  const vendedor = await db.vendedor.findUnique({ where: { id } });
  if (!vendedor) notFound();
  const pct = Number(vendedor.comisionPct ?? 0);

  const [filasMes, filasAnt, clientes, usuarios, vendedores] = await Promise.all([
    filasDelPeriodo(`${mes}-01`, `${mesSiguiente(mes)}-01`),
    filasDelPeriodo(`${mesAnterior(mes)}-01`, `${mes}-01`),
    db.cliente.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, vendedorId: true } }),
    db.usuario.findMany({ where: { rol: "VENDEDOR", activo: true, OR: [{ vendedor: null }, { vendedor: { id } }] }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    db.vendedor.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
  ]);
  const nombreDe = new Map(vendedores.map((v) => [v.id, v.nombre]));
  const suyos = clientes.filter((c) => c.vendedorId === id);
  // Los clientes dados de baja que siguen siendo de este vendedor también cuentan (para no perderlos al guardar la lista).
  const suyosInactivos = await db.cliente.findMany({ where: { vendedorId: id, activo: false }, select: { id: true, nombre: true } });
  const totalClientes = suyos.length + suyosInactivos.length;

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={`${CONTENEDOR_PEDIDOS} space-y-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/comercial/vendedores?mes=${mes}`} className="text-sm font-semibold text-stone-500 hover:underline">‹ Vendedores</Link>
          <nav className="flex items-center gap-2" aria-label="Mes">
            <Link href={`/comercial/vendedores/${id}?mes=${mesAnterior(mes)}`} className={nav} aria-label="Mes anterior">←</Link>
            <span className="min-w-44 rounded-md border border-stone-800 bg-stone-800 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-white">{nombreMes(mes)}</span>
            <Link href={`/comercial/vendedores/${id}?mes=${mesSiguiente(mes)}`} className={nav} aria-label="Mes siguiente">→</Link>
            {mes !== actual && <Link href={`/comercial/vendedores/${id}`} className={nav}>Este mes</Link>}
          </nav>
        </div>

        {unido && <p className="rounded-lg border border-verde-700 bg-verde-50 px-4 py-3 text-sm font-medium text-verde-800">Listo: {unido.slice(0, 80)} se unió a {vendedor.nombre}.</p>}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="!border-0 text-3xl font-semibold tracking-tight">{vendedor.nombre}{!vendedor.activo && <span className="ml-3 rounded-full bg-stone-200 px-3 py-1 align-middle text-sm font-medium text-stone-600">de baja</span>}</h1>
            <p className="mt-1 text-sm text-stone-500">{totalClientes} {totalClientes === 1 ? "cliente" : "clientes"}{pct ? ` · ${String(pct).replace(".", ",")}% de comisión` : " · sin % cargado"}</p>
          </div>
          <AsignarClientes
            vendedorId={id} nombre={vendedor.nombre} activo={vendedor.activo} propios={[...suyos, ...suyosInactivos].map((c) => c.id)}
            clientes={[...clientes, ...suyosInactivos.map((c) => ({ ...c, vendedorId: id }))].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((c) => ({ id: c.id, nombre: c.nombre, de: c.vendedorId && c.vendedorId !== id ? nombreDe.get(c.vendedorId) ?? null : null }))}
          />
        </div>

        <HojaVendedor nombre={vendedor.nombre} pct={pct} mes={mes} filas={filasMes.filter((x) => x.vendedorId === id)} anteriores={filasAnt.filter((x) => x.vendedorId === id)} />

        <details className="rounded-xl border border-stone-300 bg-white">
          <summary className="cursor-pointer select-none px-6 py-4 text-sm font-semibold text-stone-600 hover:text-stone-900">Datos del vendedor</summary>
          <div className="space-y-6 border-t border-stone-200 p-6">
            <FormVendedor vendedor={{ id, nombre: vendedor.nombre, pct: pct ? String(pct).replace(".", ",") : "", usuarioId: vendedor.usuarioId ?? "" }} usuarios={usuarios} />
            <div className="space-y-4 border-t border-stone-200 pt-6">
              <AccionesVendedor id={id} nombre={vendedor.nombre} activo={vendedor.activo} clientes={totalClientes} />
              <UnirVendedor id={id} nombre={vendedor.nombre} otros={vendedores.filter((v) => v.id !== id)} />
            </div>
          </div>
        </details>
      </main>
    </>
  );
}
