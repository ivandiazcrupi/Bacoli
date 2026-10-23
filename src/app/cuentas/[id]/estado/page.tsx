import Link from "next/link";
import { notFound } from "next/navigation";
import { incluirNc } from "@/lib/cobranza";
import { db } from "@/lib/db";
import { cargarFacturas } from "@/lib/facturas";
import { hoy } from "@/lib/fechas";
import { formatoPesos } from "@/lib/numeros";
import { exigirOficina } from "@/lib/session";
import { BarraImpresion } from "../../../pedidos/remito/BarraImpresion";
import { filaDeArca, filaDeRemito } from "../../filas";

const corta = (s: string | null | undefined) => (s ? `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—");

// El título es el nombre con el que el navegador propone guardar el PDF: cliente y fecha.
export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ razon?: string }> }) {
  const { id } = await params;
  const { razon } = await searchParams;
  const c = await db.cliente.findUnique({ where: { id }, select: { nombre: true } });
  const limpio = (t: string) => t.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  const [a, m, d] = hoy().split("-");
  return { title: `Cuenta corriente - ${limpio(razon || c?.nombre || "Cliente")} - ${d}-${m}-${a}` };
}

// Estado de cuenta para pasarle al cliente: una hoja A4 limpia (sin datos internos) que se imprime o se guarda como PDF.
// Por defecto muestra lo que debe; ?ver=todas suma también lo pagado.
export default async function EstadoDeCuenta({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ver?: string; razon?: string }> }) {
  await exigirOficina();
  const { id } = await params;
  const { ver, razon } = await searchParams;
  const todas = ver === "todas";
  const [cliente, empresa] = await Promise.all([db.cliente.findUnique({ where: { id } }), db.empresa.findUnique({ where: { id: "principal" } })]);
  if (!cliente) notFound();
  const hoyStr = hoy();
  const [pedidos, facturas] = await Promise.all([
    db.pedido.findMany({
      where: { clienteId: id, conFactura: false, OR: [{ estado: { in: ["PENDIENTE", "ENTREGADO"] } }, { remitoNumero: { not: null } }] },
      include: { items: true, punto: true, ...incluirNc }, orderBy: [{ creadoEn: "asc" }],
    }),
    cargarFacturas(),
  ]);
  const filasArca = facturas.filas.filter((f) => f.clienteId === id).map((f) => filaDeArca(f, facturas.puntosDeCuit(f.cuit)));
  const filas = [...filasArca, ...pedidos.map((p) => filaDeRemito(p, cliente, hoyStr))]
    .filter((f) => !razon || (f.razon ?? "") === razon)
    .filter((f) => !f.anulado && !f.cubierta && (f.esNc ? (f.saldo ?? 0) > 0.01 : todas || !f.pagada))
    .sort((a, b) => a.cargado.localeCompare(b.cargado) || (a.numero ?? "").localeCompare(b.numero ?? ""));
  const debe = filas.filter((f) => !f.esNc && !f.pagada && f.entregado).reduce((s, f) => s + f.monto, 0);
  const porEntregar = filas.filter((f) => !f.esNc && !f.pagada && !f.entregado).reduce((s, f) => s + f.monto, 0);
  const aFavor = filas.filter((f) => f.esNc).reduce((s, f) => s + (f.saldo ?? 0), 0);

  return (
    <div className="bg-stone-200 print:bg-white">
      <style>{"@page { size: A4; margin: 14mm } @media print { html { font-size: 13px !important } body { background: #fff !important; padding-bottom: 0 !important } }"}</style>
      <BarraImpresion volver={`/cuentas/${id}`} />
      <div className="mx-auto mt-3 flex max-w-[210mm] justify-end gap-2 px-2 text-sm print:hidden">
        <Link href={`/cuentas/${id}/estado`} className={`rounded-md border px-3 py-1.5 ${todas ? "border-stone-400 bg-white" : "border-stone-800 bg-stone-800 font-semibold text-white"}`}>Solo lo que debe</Link>
        <Link href={`/cuentas/${id}/estado?ver=todas`} className={`rounded-md border px-3 py-1.5 ${todas ? "border-stone-800 bg-stone-800 font-semibold text-white" : "border-stone-400 bg-white"}`}>Con lo pagado</Link>
        <span className="py-1.5 text-stone-500">Para guardar en PDF: Imprimir → destino “Guardar como PDF”.</span>
      </div>
      <div className="py-4 print:py-0">
        <section className="mx-auto min-h-[270mm] w-[210mm] bg-white p-[12mm] font-[Helvetica,Arial,sans-serif] text-neutral-900 shadow print:min-h-0 print:w-full print:p-0 print:shadow-none">
          <header className="flex items-end justify-between border-b border-neutral-900 pb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-neutral-500">{empresa?.nombreComercial || "BACOLI"}</p>
              <h1 className="mt-1 text-[26px] font-bold leading-none tracking-tight">Estado de cuenta</h1>
            </div>
            <p className="text-right text-[12px] text-neutral-600">Al {corta(hoyStr)}</p>
          </header>
          <div className="mt-4 text-[13px]">
            <p className="text-[17px] font-bold">{cliente.nombre}</p>
            {razon ? <p className="text-neutral-600">{razon}</p> : cliente.razonSocial && cliente.razonSocial !== cliente.nombre && <p className="text-neutral-600">{cliente.razonSocial}</p>}
            {cliente.cuit && <p className="text-neutral-600">CUIT {cliente.cuit}</p>}
          </div>
          <table className="mt-5 w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-neutral-900 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                <th className="py-2">Comprobante</th><th>Sucursal</th><th>Pedido</th><th>Entrega</th><th className="text-right">Monto</th><th className="pl-4">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={`${f.tipo}-${f.id}`} className="border-b border-neutral-200 [break-inside:avoid]">
                  <td className="py-2 font-semibold tabular-nums">{f.numero ?? "—"}</td>
                  <td>{f.sucursal ?? ""}</td>
                  <td className="tabular-nums">{corta(f.cargado)}</td>
                  <td className="tabular-nums">{corta(f.entrega)}</td>
                  <td className="text-right font-semibold tabular-nums">{f.esNc ? "−" : ""}{formatoPesos(f.esNc ? (f.saldo ?? 0) : f.pagada ? f.bruto : f.monto)}</td>
                  <td className="pl-4">{f.esNc ? "Nota de crédito a favor" : f.pagada ? "Pagada" : f.entregado ? "Pendiente" : "Por entregar"}</td>
                </tr>
              ))}
              {filas.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-neutral-500">No hay comprobantes para mostrar.</td></tr>}
            </tbody>
          </table>
          <dl className="ml-auto mt-6 w-72 space-y-1.5 text-[13px]">
            {porEntregar > 0.01 && <div className="flex justify-between text-neutral-600"><dt>Por entregar</dt><dd className="tabular-nums">{formatoPesos(porEntregar)}</dd></div>}
            {aFavor > 0.01 && <div className="flex justify-between text-neutral-600"><dt>Saldo a favor</dt><dd className="tabular-nums">−{formatoPesos(aFavor)}</dd></div>}
            <div className="flex justify-between border-t border-neutral-900 pt-2 text-[17px] font-bold"><dt>Total a pagar</dt><dd className="tabular-nums">{formatoPesos(Math.max(0, debe - aFavor))}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}
