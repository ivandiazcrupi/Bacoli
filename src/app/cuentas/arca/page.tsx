import { Cabecera } from "@/components/Cabecera";
import { nombreComprobante } from "@/lib/arca";
import { importeVigente } from "@/lib/cuenta";
import { db } from "@/lib/db";
import { formatoPesos } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import { EncabezadoCuenta } from "../EncabezadoCuenta";
import { SubirArchivo } from "./SubirArchivo";
import { SucursalArca } from "./SucursalArca";

const soloDigitos = (t: string | null | undefined) => (t ?? "").replace(/\D/g, "");
const fechaCorta = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCFullYear()).slice(2)}`;
const numeroArca = (pto: number, n: number) => `${String(pto).padStart(5, "0")}-${String(n).padStart(8, "0")}`;
// El número que se escribe en la hoja de ruta (F-4525, o 0001-00000012 en los viejos) → el número de factura.
const numeroDe = (t: string | null) => {
  const s = (t ?? "").replace(/^F-/i, "").trim();
  const n = parseInt((s.includes("-") ? s.split("-").pop()! : s).replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : null;
};

const th = "px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-600";
const td = "px-3 py-2 text-center text-[13px]";

// Conciliación con ARCA: compara lo que ARCA emitió con los números escritos en los pedidos. El cruce es EXACTO por número.
export default async function Arca() {
  const usuario = await exigirOficina();
  const [arca, pedidos, clientes] = await Promise.all([
    db.comprobanteArca.findMany({ orderBy: [{ numero: "asc" }] }),
    db.pedido.findMany({ where: { conFactura: true, numeroFactura: { not: null }, clienteId: { not: null } }, include: { items: true, cliente: true, punto: true } }),
    db.cliente.findMany({ where: { cuit: { not: null } }, select: { id: true, nombre: true, cuit: true, puntos: { where: { activo: true }, select: { id: true, barrio: true, direccion: true }, orderBy: { barrio: "asc" } } } }),
  ]);
  const facturas = arca.filter((c) => !c.esNotaCredito);
  const notas = arca.filter((c) => c.esNotaCredito);
  const porCuit = new Map(clientes.map((c) => [soloDigitos(c.cuit), c]));
  const porNumero = new Map<number, typeof facturas>();
  for (const f of facturas) porNumero.set(f.numero, [...(porNumero.get(f.numero) ?? []), f]);

  type Par = { pedido: (typeof pedidos)[number]; arca: (typeof facturas)[number]; total: number; problemas: string[] };
  const cruzan: Par[] = [];
  const sinArca: typeof pedidos = [];
  const usadas = new Set<string>();
  const minNum = facturas.length ? Math.min(...facturas.map((f) => f.numero)) : 0;
  const maxNum = facturas.length ? Math.max(...facturas.map((f) => f.numero)) : 0;
  let fuera = 0;
  for (const p of pedidos) {
    const n = numeroDe(p.numeroFactura);
    if (n === null) continue;
    const candidatas = porNumero.get(n) ?? [];
    if (candidatas.length === 0) {
      if (facturas.length && n >= minNum && n <= maxNum) sinArca.push(p); else fuera++;
      continue;
    }
    const a = candidatas[0];
    usadas.add(a.id);
    const total = importeVigente(p.items, Number(p.ivaPct), p.estado === "ENTREGADO" ? "ENTREGADO" : "PENDIENTE", p.webTotal);
    const problemas: string[] = [];
    const cuitPedido = soloDigitos(p.cliente?.cuit);
    if (!cuitPedido) problemas.push("El cliente no tiene CUIT cargado");
    else if (a.cuitReceptor && cuitPedido !== a.cuitReceptor) problemas.push(`CUIT distinto: el cliente tiene ${p.cliente?.cuit} y ARCA ${a.cuitReceptor}`);
    if (Math.abs(total - Number(a.total)) > 1) problemas.push(`Importe distinto: pedido ${formatoPesos(total)} · ARCA ${formatoPesos(Number(a.total))}`);
    if (p.estado === "CANCELADO") problemas.push("El pedido está cancelado pero la factura existe en ARCA");
    cruzan.push({ pedido: p, arca: a, total, problemas });
  }
  const conProblemas = cruzan.filter((c) => c.problemas.length);
  const sinPedido = facturas.filter((f) => !usadas.has(f.id));

  const resumen = (n: number, texto: string, mal: boolean) => (
    <div className={`rounded-lg border px-4 py-3 text-center ${mal && n > 0 ? "border-rojo-600 bg-rojo-50" : "border-stone-300 bg-white"}`}>
      <p className={`text-2xl font-bold tabular-nums ${mal && n > 0 ? "text-rojo-700" : "text-stone-900"}`}>{n}</p>
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">{texto}</p>
    </div>
  );

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoCuenta activa="arca" />
        <section className="rounded-xl border border-stone-300 bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold">Comparar con ARCA</h2>
          <p className="mt-1 text-sm text-stone-600">Subí el archivo de <b>Mis Comprobantes → Emitidos</b> que bajás de ARCA (CSV). El sistema lo compara con los números de factura escritos en los pedidos. Por ahora <b>solo compara</b>: no cambia pedidos ni cuenta corriente.</p>
          <div className="mt-3"><SubirArchivo /></div>
        </section>

        {arca.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-400 p-8 text-center text-stone-600">Todavía no se subió ningún archivo de ARCA.</p>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Resumen">
              {resumen(facturas.length, "Facturas en ARCA", false)}
              {resumen(cruzan.length - conProblemas.length, "Cruzan bien", false)}
              {resumen(conProblemas.length, "Cruzan con diferencias", true)}
              {resumen(sinPedido.length, "En ARCA sin pedido", true)}
              {resumen(sinArca.length, "Escritas que ARCA no tiene", true)}
            </section>
            {fuera > 0 && <p className="text-xs text-stone-500">{fuera} pedidos con factura tienen un número fuera del rango del archivo ({minNum} a {maxNum}); no se pueden comparar con este archivo.</p>}

            {sinArca.length > 0 && (
              <section className="overflow-hidden rounded-xl border border-rojo-600 bg-white" aria-label="Números escritos que ARCA no tiene">
                <h3 className="bg-rojo-50 px-4 py-2 text-sm font-bold text-rojo-700">Números escritos en la hoja de ruta que ARCA no tiene (dedazo, o la factura no se emitió)</h3>
                <table className="w-full"><thead><tr><th className={th}>Número escrito</th><th className={th}>Cliente</th><th className={th}>Estado</th><th className={th}>Pedido</th></tr></thead><tbody className="divide-y divide-stone-200">
                  {sinArca.map((p) => <tr key={p.id}><td className={`${td} font-bold`}>{p.numeroFactura}</td><td className={td}>{p.cliente?.nombre}</td><td className={td}>{p.estado === "ENTREGADO" ? "Entregado" : p.estado === "CANCELADO" ? "Cancelado" : "Pendiente"}</td><td className={td}><a href={`/pedidos/${p.id}`} className="font-semibold text-verde-800 underline-offset-4 hover:underline">Abrir ›</a></td></tr>)}
                </tbody></table>
              </section>
            )}

            {sinPedido.length > 0 && (
              <section className="overflow-hidden rounded-xl border border-rojo-600 bg-white" aria-label="Facturas de ARCA sin pedido">
                <h3 className="bg-rojo-50 px-4 py-2 text-sm font-bold text-rojo-700">Facturas de ARCA que ningún pedido tiene (se facturó y no está cargado el número)</h3>
                <table className="w-full"><thead><tr><th className={th}>Factura</th><th className={th}>Fecha</th><th className={th}>Receptor</th><th className={th}>CUIT</th><th className={th}>Cliente en el sistema</th><th className={th}>Sucursal / observación</th><th className={th}>Importe</th></tr></thead><tbody className="divide-y divide-stone-200">
                  {sinPedido.map((f) => {
                    const cliente = porCuit.get(f.cuitReceptor ?? "");
                    return <tr key={f.id}><td className={`${td} font-bold`}>{nombreComprobante(f.tipo)} {numeroArca(f.puntoVenta, f.numero)}</td><td className={td}>{fechaCorta(f.fecha)}</td><td className={td}>{f.razonSocial ?? "—"}</td><td className={`${td} tabular-nums`}>{f.cuitReceptor ?? "—"}</td><td className={td}>{cliente?.nombre ?? <span className="font-semibold text-rojo-700">Cliente no encontrado</span>}</td><td className={`${td} min-w-[15rem]`}><SucursalArca id={f.id} puntos={cliente?.puntos ?? []} puntoId={f.puntoId} observacion={f.observacion} /></td><td className={`${td} font-bold tabular-nums`}>{formatoPesos(Number(f.total))}</td></tr>;
                  })}
                </tbody></table>
              </section>
            )}

            {conProblemas.length > 0 && (
              <section className="overflow-hidden rounded-xl border border-stone-400 bg-white" aria-label="Cruzan con diferencias">
                <h3 className="bg-crema-200 px-4 py-2 text-sm font-bold text-stone-800">Cruzan por número, pero con diferencias</h3>
                <table className="w-full"><thead><tr><th className={th}>Número</th><th className={th}>Cliente</th><th className={th}>Sucursal</th><th className={th}>Diferencia</th><th className={th}>Pedido</th></tr></thead><tbody className="divide-y divide-stone-200">
                  {conProblemas.map((c) => <tr key={c.pedido.id}><td className={`${td} font-bold`}>{c.pedido.numeroFactura}</td><td className={td}>{c.pedido.cliente?.nombre}</td><td className={td}>{c.pedido.punto?.barrio ?? "—"}</td><td className={`${td} text-left font-medium text-rojo-700`}>{c.problemas.map((x) => <span key={x} className="block">{x}</span>)}</td><td className={td}><a href={`/pedidos/${c.pedido.id}`} className="font-semibold text-verde-800 underline-offset-4 hover:underline">Abrir ›</a></td></tr>)}
                </tbody></table>
              </section>
            )}

            {cruzan.length - conProblemas.length > 0 && (
              <details className="overflow-hidden rounded-xl border border-stone-300 bg-white">
                <summary className="cursor-pointer bg-crema-200 px-4 py-2 text-sm font-bold text-stone-800">Cruzan bien ({cruzan.length - conProblemas.length}): número, cliente y sucursal del pedido</summary>
                <table className="w-full"><thead><tr><th className={th}>Número</th><th className={th}>Cliente</th><th className={th}>Sucursal</th><th className={th}>Importe</th></tr></thead><tbody className="divide-y divide-stone-200">
                  {cruzan.filter((c) => !c.problemas.length).map((c) => <tr key={c.pedido.id}><td className={`${td} font-bold`}>{c.pedido.numeroFactura}</td><td className={td}>{c.pedido.cliente?.nombre}</td><td className={td}>{c.pedido.punto?.barrio ?? "—"}</td><td className={`${td} font-bold tabular-nums`}>{formatoPesos(c.total)}</td></tr>)}
                </tbody></table>
              </details>
            )}

            {notas.length > 0 && (
              <section className="overflow-hidden rounded-xl border border-stone-300 bg-white" aria-label="Notas de crédito de ARCA">
                <h3 className="bg-crema-200 px-4 py-2 text-sm font-bold text-stone-800">Notas de crédito emitidas en ARCA ({notas.length})</h3>
                <table className="w-full"><thead><tr><th className={th}>Nota</th><th className={th}>Fecha</th><th className={th}>Receptor</th><th className={th}>CUIT</th><th className={th}>Importe</th></tr></thead><tbody className="divide-y divide-stone-200">
                  {notas.map((f) => <tr key={f.id}><td className={`${td} font-bold`}>{nombreComprobante(f.tipo)} {numeroArca(f.puntoVenta, f.numero)}</td><td className={td}>{fechaCorta(f.fecha)}</td><td className={td}>{f.razonSocial ?? "—"}</td><td className={`${td} tabular-nums`}>{f.cuitReceptor ?? "—"}</td><td className={`${td} font-bold tabular-nums`}>{formatoPesos(Number(f.total))}</td></tr>)}
                </tbody></table>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
