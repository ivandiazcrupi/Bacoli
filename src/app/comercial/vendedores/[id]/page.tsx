import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { vendedoresDesbloqueado } from "@/lib/claveVendedores";
import { db } from "@/lib/db";
import { esFechaValida, hoy } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { mesAnterior, mesSiguiente, nombreMes, ventasEntregadas } from "@/lib/vendedores";
import { CONTENEDOR_PEDIDOS } from "../../../pedidos/Encabezado";
import { PantallaBloqueada } from "../Bloqueo";
import { AccionesVendedor, AsignarClientes, FormVendedor } from "../Formularios";

const nav = "flex h-9 items-center rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold hover:border-stone-600";

// Un vendedor, como la ficha de un cliente: sus datos para editar, cuánto vendió el mes y a quién.
export default async function FichaVendedor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string }> }) {
  const usuario = await exigirOficina();
  if (!(await vendedoresDesbloqueado())) return <PantallaBloqueada usuario={usuario} />;
  const { id } = await params;
  const { mes: mesParam } = await searchParams;
  const actual = hoy().slice(0, 7);
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) && esFechaValida(`${mesParam}-01`) ? mesParam : actual;
  const vendedor = await db.vendedor.findUnique({ where: { id } });
  if (!vendedor) notFound();
  const pct = Number(vendedor.comisionPct ?? 0);

  const [ventas, clientes, usuarios, vendedores] = await Promise.all([
    ventasEntregadas(`${mes}-01`, `${mesSiguiente(mes)}-01`),
    db.cliente.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, vendedorId: true } }),
    db.usuario.findMany({ where: { rol: "VENDEDOR", activo: true, OR: [{ vendedor: null }, { vendedor: { id } }] }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    db.vendedor.findMany({ select: { id: true, nombre: true } }),
  ]);
  const nombreDe = new Map(vendedores.map((v) => [v.id, v.nombre]));
  const mias = ventas.filter((x) => x.vendedorId === id);
  const neto = mias.reduce((t, x) => t + x.neto, 0);
  const porCliente = new Map<string, { nombre: string; pedidos: number; neto: number }>();
  for (const x of mias) {
    const c = porCliente.get(x.clienteId) ?? { nombre: x.cliente, pedidos: 0, neto: 0 };
    c.pedidos += 1; c.neto += x.neto; porCliente.set(x.clienteId, c);
  }
  const filas = [...porCliente.entries()].map(([cid, c]) => ({ cid, ...c })).sort((a, b) => b.neto - a.neto);
  const suyos = clientes.filter((c) => c.vendedorId === id);
  // Los clientes dados de baja que siguen siendo de este vendedor también cuentan (para no perderlos al guardar la lista).
  const suyosInactivos = await db.cliente.findMany({ where: { vendedorId: id, activo: false }, select: { id: true, nombre: true } });

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={`${CONTENEDOR_PEDIDOS} space-y-8`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/comercial/vendedores?mes=${mes}`} className="text-sm font-semibold text-stone-500 hover:underline">‹ Vendedores</Link>
          <nav className="flex items-center gap-2" aria-label="Mes">
            <Link href={`/comercial/vendedores/${id}?mes=${mesAnterior(mes)}`} className={nav} aria-label="Mes anterior">←</Link>
            <span className="min-w-40 text-center text-sm font-semibold capitalize text-stone-700">{nombreMes(mes)}</span>
            <Link href={`/comercial/vendedores/${id}?mes=${mesSiguiente(mes)}`} className={nav} aria-label="Mes siguiente">→</Link>
          </nav>
        </div>

        <section className="mx-auto w-full max-w-3xl space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-tight">{vendedor.nombre}{!vendedor.activo && <span className="ml-3 rounded-full bg-stone-200 px-3 py-1 align-middle text-sm font-medium text-stone-600">de baja</span>}</h1>
            <AsignarClientes
              vendedorId={id} nombre={vendedor.nombre} activo={vendedor.activo} propios={[...suyos, ...suyosInactivos].map((c) => c.id)}
              clientes={[...clientes, ...suyosInactivos.map((c) => ({ ...c, vendedorId: id }))].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((c) => ({ id: c.id, nombre: c.nombre, de: c.vendedorId && c.vendedorId !== id ? nombreDe.get(c.vendedorId) ?? null : null }))}
            />
          </div>

          <div className="grid grid-cols-3 gap-6 rounded-2xl border border-stone-200 bg-white px-8 py-6 text-center">
            <div><p className="text-xs text-stone-400">Clientes</p><p className="mt-1 text-2xl font-semibold tabular-nums">{suyos.length + suyosInactivos.length}</p></div>
            <div><p className="text-xs text-stone-400">Vendió en {nombreMes(mes).split(" ")[0]}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatoPesos(neto)}</p></div>
            <div><p className="text-xs text-stone-400">Comisión{pct ? ` · ${String(pct).replace(".", ",")}%` : ""}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatoPesos((neto * pct) / 100)}</p></div>
          </div>

          {filas.length > 0 && (
            <div>
              <h2 className="mb-2 px-1 text-sm font-medium text-stone-500">A quién le vendió</h2>
              <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
                {filas.map((f) => (
                  <li key={f.cid} className="flex items-center justify-between gap-4 px-6 py-3.5">
                    <Link href={`/clientes/${f.cid}/pedidos`} className="text-[15px] hover:underline">{f.nombre}</Link>
                    <span className="text-sm text-stone-500">{f.pedidos} {f.pedidos === 1 ? "pedido" : "pedidos"}</span>
                    <span className="min-w-28 text-right text-[15px] font-medium tabular-nums">{formatoPesos(f.neto)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {filas.length === 0 && <p className="text-center text-sm text-stone-500">Sin ventas entregadas en este mes.</p>}

          <div className="space-y-6 rounded-2xl border border-stone-200 bg-white p-8">
            <h2 className="text-sm font-medium text-stone-500">Datos del vendedor</h2>
            <FormVendedor vendedor={{ id, nombre: vendedor.nombre, pct: pct ? String(pct).replace(".", ",") : "", usuarioId: vendedor.usuarioId ?? "" }} usuarios={usuarios} />
            <div className="border-t border-stone-200 pt-6"><AccionesVendedor id={id} nombre={vendedor.nombre} activo={vendedor.activo} clientes={suyos.length + suyosInactivos.length} /></div>
          </div>
        </section>
      </main>
    </>
  );
}
