import Link from "next/link";
import { redirect } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { esFechaValida, hoy } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { mesAnterior, mesSiguiente, nombreMes, ventasEntregadas } from "@/lib/vendedores";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import { EncabezadoComercial } from "../EncabezadoComercial";
import { BotonActivo, BotonesResolver, BotonesTodas, FormComision, FormPasar, FormProponer, FormVendedor } from "./Formularios";

const fechaCorta = (d: Date) => d.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "2-digit" });
const nav = "flex h-9 items-center rounded-md border border-stone-300 bg-white px-3 text-sm font-semibold hover:border-stone-600";

// VENDEDORES (solo dueños): cada vendedor con su %, lo que vendió y su comisión; y el doble chequeo para asignarle clientes.
export default async function Vendedores({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const usuario = await exigirOficina();
  if (usuario.rol !== "DUENO") redirect("/comercial");
  const { mes: mesParam } = await searchParams;
  const actual = hoy().slice(0, 7);
  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) && esFechaValida(`${mesParam}-01`) ? mesParam : actual;

  const [vendedores, clientes, pendientes, ventas, ventasAnt, usuariosLibres, conComisionista, aprobador] = await Promise.all([
    db.vendedor.findMany({ orderBy: [{ activo: "desc" }, { nombre: "asc" }], include: { _count: { select: { clientes: true } }, usuario: { select: { nombre: true } } } }),
    db.cliente.findMany({ where: { activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, vendedorId: true } }),
    db.asignacionVendedor.findMany({ where: { estado: "PENDIENTE" }, orderBy: { propuestoEn: "asc" }, include: { cliente: { select: { nombre: true, vendedorId: true } } } }),
    ventasEntregadas(`${mes}-01`, `${mesSiguiente(mes)}-01`),
    ventasEntregadas(`${mesAnterior(mes)}-01`, `${mes}-01`),
    db.usuario.findMany({ where: { rol: "VENDEDOR", activo: true, vendedor: null }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    db.cliente.findMany({ where: { comisionista: { not: null } }, select: { comisionista: true, comisionPct: true } }),
    db.usuario.findFirst({ where: { apruebaVendedores: true, activo: true }, select: { nombre: true } }),
  ]);
  const nombresUsuarios = new Map((await db.usuario.findMany({ select: { id: true, nombre: true } })).map((u) => [u.id, u.nombre]));
  const nombresVendedores = new Map(vendedores.map((v) => [v.id, v.nombre]));
  const nom = (id: string | null) => (id ? nombresVendedores.get(id) ?? "—" : "Sin vendedor");

  // Comisionistas escritos en las fichas de los clientes (ej. Migue 8%) que todavía no son vendedores.
  const yaVendedor = new Set(vendedores.map((v) => v.nombre.trim().toLowerCase()));
  const grupos = new Map<string, { nombre: string; clientes: number; pct: number }>();
  for (const c of conComisionista) {
    const nombre = (c.comisionista ?? "").trim();
    if (!nombre || yaVendedor.has(nombre.toLowerCase())) continue;
    const g = grupos.get(nombre.toLowerCase()) ?? { nombre, clientes: 0, pct: 0 };
    g.clientes += 1; g.pct = Math.max(g.pct, Number(c.comisionPct ?? 0));
    grupos.set(nombre.toLowerCase(), g);
  }
  const comisionistas = [...grupos.values()].sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));

  const resumen = vendedores.map((v) => {
    const pct = Number(v.comisionPct ?? 0);
    const mias = ventas.filter((x) => x.vendedorId === v.id), antes = ventasAnt.filter((x) => x.vendedorId === v.id);
    const neto = mias.reduce((t, x) => t + x.neto, 0), netoAnt = antes.reduce((t, x) => t + x.neto, 0);
    return { v, pct, neto, netoAnt, pedidos: mias.length, comision: (neto * pct) / 100, clientes: v._count.clientes };
  });
  const sinVendedor = ventas.filter((x) => !x.vendedorId || !vendedores.some((v) => v.id === x.vendedorId));
  const totComision = resumen.reduce((t, r) => t + r.comision, 0);
  const sinAsignar = clientes.filter((c) => !c.vendedorId).length;
  const variacion = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);

  const nuevoClienteOpciones = clientes.map((c) => ({ id: c.id, nombre: c.vendedorId ? `${c.nombre} (hoy: ${nom(c.vendedorId)})` : c.nombre }));
  const opcionesVendedor = vendedores.filter((v) => v.activo).map((v) => ({ id: v.id, nombre: v.nombre }));

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={`${CONTENEDOR_PEDIDOS} space-y-4`}>
        <EncabezadoComercial
          activa="vendedores" esDueno
          derecha={
            <nav className="flex items-center gap-2" aria-label="Mes">
              <Link href={`/comercial/vendedores?mes=${mesAnterior(mes)}`} className={nav} aria-label="Mes anterior">←</Link>
              <span className="min-w-44 rounded-md border border-stone-800 bg-stone-800 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-white">{nombreMes(mes)}</span>
              <Link href={`/comercial/vendedores?mes=${mesSiguiente(mes)}`} className={nav} aria-label="Mes siguiente">→</Link>
              {mes !== actual && <Link href="/comercial/vendedores" className={nav}>Este mes</Link>}
            </nav>
          }
        />

        {pendientes.length > 0 && (
          <section className="rounded-lg border border-[#e6d58a] bg-[#fdf8e3] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold uppercase tracking-wide text-[#8a6a05]">Cambios pendientes de aprobación · {pendientes.length}</h2>{pendientes.length > 1 && usuario.apruebaVendedores && <BotonesTodas cantidad={pendientes.length} />}</div>
            <p className="mt-0.5 text-[13px] text-stone-600">{aprobador ? <>Los aprueba <b>{aprobador.nombre}</b>.</> : <b className="text-rojo-700">Nadie tiene asignado aprobar: elegilo en USUARIOS (“Aprueba vendedores”).</b>} Hasta que se aprueben, el cliente sigue con su vendedor actual.</p>
            <ul className="mt-2 divide-y divide-[#eadfa6]">
              {pendientes.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-[14px]">
                  <span>
                    <b>{a.cliente.nombre}</b>: {nom(a.cliente.vendedorId)} <span className="text-stone-400">→</span> <b>{nom(a.vendedorId)}</b>
                    <span className="ml-2 text-[12px] text-stone-500">vale desde {a.desde ? `${a.desde.slice(8)}/${a.desde.slice(5, 7)}/${a.desde.slice(2, 4)}` : "la aprobación"} · propuesto por {nombresUsuarios.get(a.propuestoPor) ?? "—"} el {fechaCorta(a.propuestoEn)}</span>
                  </span>
                  <BotonesResolver id={a.id} mio={a.propuestoPor === usuario.id} puede={!!usuario.apruebaVendedores} aprobador={aprobador?.nombre ?? null} cliente={a.cliente.nombre} vendedor={nom(a.vendedorId)} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="overflow-hidden rounded-lg border border-stone-300 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Vendedores · {nombreMes(mes)}</h2>
            <span className="text-[13px] text-stone-500">Comisión sobre ventas <b>sin IVA</b> de pedidos <b>entregados</b></span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-center text-[13.5px]">
              <thead className="bg-stone-100 text-[11px] uppercase tracking-wide text-stone-600">
                <tr><th className="px-3 py-2 text-left font-semibold">Vendedor</th><th className="px-3 py-2 font-semibold">% comisión</th><th className="px-3 py-2 font-semibold">Clientes</th><th className="px-3 py-2 font-semibold">Pedidos</th><th className="px-3 py-2 font-semibold">Vendió (sin IVA)</th><th className="px-3 py-2 font-semibold">vs mes anterior</th><th className="px-3 py-2 font-semibold">Comisión</th><th className="w-48 px-3 py-2" /></tr>
              </thead>
              <tbody>
                {resumen.map(({ v, pct, neto, netoAnt, pedidos, comision, clientes: nc }) => {
                  const vs = variacion(neto, netoAnt);
                  return (
                    <tr key={v.id} className={`h-14 border-t border-stone-200 ${v.activo ? "" : "opacity-60"}`}>
                      <td className="px-3 text-left"><Link href={`/comercial/vendedores/${v.id}?mes=${mes}`} className="font-semibold hover:underline">{v.nombre}</Link>{!v.activo && <span className="ml-2 rounded bg-stone-200 px-1.5 py-0.5 text-[11px] font-normal text-stone-600">de baja</span>}{v.usuario && <div className="text-[11.5px] font-normal text-stone-500">entra como {v.usuario.nombre}</div>}</td>
                      <td className="px-3"><FormComision vendedorId={v.id} pct={pct ? String(pct).replace(".", ",") : ""} /></td>
                      <td className="px-3 tabular-nums">{nc}</td>
                      <td className="px-3 tabular-nums">{pedidos}</td>
                      <td className="px-3 font-semibold tabular-nums">{formatoPesos(neto)}</td>
                      <td className={`px-3 tabular-nums ${vs === null ? "text-stone-400" : vs >= 0 ? "text-verde-700" : "text-rojo-700"}`}>{vs === null ? "—" : `${vs >= 0 ? "▲" : "▼"} ${Math.abs(vs)}%`}</td>
                      <td className="px-3 font-bold tabular-nums">{formatoPesos(comision)}</td>
                      <td className="px-3"><span className="inline-flex items-center gap-1.5"><Link href={`/comercial/vendedores/${v.id}?mes=${mes}`} className="rounded border border-stone-300 bg-white px-2.5 py-1 text-[12px] font-semibold hover:border-stone-500">Abrir ›</Link><BotonActivo id={v.id} activo={v.activo} clientes={nc} chico /></span></td>
                    </tr>
                  );
                })}
                {resumen.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-stone-500">Todavía no hay vendedores. Cargá el primero abajo, en “Nuevo vendedor”.</td></tr>}
              </tbody>
              {resumen.length > 0 && (
                <tfoot><tr className="h-12 border-t-2 border-stone-300 bg-stone-50 font-semibold"><td className="px-3 text-left">Total a pagar en comisiones</td><td colSpan={5} /><td className="px-3 text-base font-bold tabular-nums">{formatoPesos(totComision)}</td><td /></tr></tfoot>
              )}
            </table>
          </div>
          <p className="border-t border-stone-200 px-4 py-2 text-[12.5px] text-stone-500">
            Ventas del mes sin vendedor: <b className="text-stone-700">{formatoPesos(sinVendedor.reduce((t, x) => t + x.neto, 0))}</b> · {sinAsignar} {sinAsignar === 1 ? "cliente activo" : "clientes activos"} sin vendedor asignado.
          </p>
        </section>

        <section className="rounded-lg border border-stone-300 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Nuevo vendedor</h2>
          <p className="mb-3 mt-0.5 text-[13px] text-stone-600">Un vendedor es quien comisiona por las ventas de sus clientes (ej. Migue). <b>No hace falta que entre al sistema</b>: si querés que cargue sus pedidos, enlazalo con un usuario de rol Vendedor (los usuarios se crean en el menú USUARIOS).</p>
          <FormVendedor usuarios={usuariosLibres} />
        </section>

        {comisionistas.length > 0 && (
          <section className="rounded-lg border border-stone-300 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Comisionistas escritos en las fichas de clientes</h2>
            <p className="mt-0.5 text-[13px] text-stone-600">Ya los tenías anotados en la ficha (Comisionista / Comisión %). Con “Pasar a vendedor” se crea el vendedor con ese % y se proponen todos sus clientes; <b>quedan pendientes hasta que se aprueben</b>. No se borra nada de las fichas.</p>
            <div className="mt-1 divide-y divide-stone-200">
              {comisionistas.map((c) => <FormPasar key={c.nombre} comisionista={c.nombre} clientes={c.clientes} pct={c.pct ? String(c.pct).replace(".", ",") : ""} />)}
            </div>
          </section>
        )}

        <section className="rounded-lg border border-stone-300 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Asignar un vendedor a un cliente</h2>
          <p className="mb-3 mt-0.5 text-[13px] text-stone-600">Se propone acá y <b>lo aprueba {aprobador ? aprobador.nombre : "quien tenga asignado aprobar"}</b>. Elegís desde qué fecha vale: las ventas desde ese día cuentan para el nuevo vendedor y las anteriores quedan con el que tenía.</p>
          <FormProponer vendedores={opcionesVendedor} clientes={nuevoClienteOpciones} />
        </section>
      </main>
    </>
  );
}
