import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { incluirNc, partidaDe } from "@/lib/cobranza";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../../../pedidos/Encabezado";
import { FormNC } from "./FormNC";

export default async function CargarNotaCredito({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ factura?: string; nota?: string }> }) {
  const usuario = await exigirOficina();
  const { id } = await params;
  const { factura, nota: notaId } = await searchParams;
  const cliente = await db.cliente.findUnique({ where: { id } });
  if (!cliente) notFound();

  const pedidos = await db.pedido.findMany({
    where: { clienteId: id, estado: { in: ["PENDIENTE", "ENTREGADO"] }, pagado: false },
    include: { items: true, ...incluirNc },
    orderBy: [{ fechaEntrega: "asc" }, { creadoEn: "asc" }],
  });
  const comprobantes = pedidos
    .map((p) => partidaDe(p, cliente.condicionPago))
    .filter((x) => !x.cubierta)
    .map((x) => ({ id: x.id, tipo: x.tipo, numero: x.numero, fecha: x.fecha, debe: x.monto }));

  let nota = null;
  if (notaId) {
    const n = await db.notaCredito.findUnique({ where: { id: notaId }, include: { aplicaciones: true } });
    if (n && n.clienteId === id && !n.anuladaEn) nota = { id: n.id, numero: n.numero, restante: Number(n.monto) - n.aplicaciones.reduce((t, a) => t + Number(a.monto), 0) };
  }

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{nota ? "Aplicar saldo de nota de crédito" : "Nueva nota de crédito"}</h1>
            <p className="mt-1 text-lg font-semibold">{cliente.nombre}</p>
          </div>
          <Link href={`/cuentas/${id}`} className="rounded-md border border-stone-400 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-crema-100">← Cuenta del cliente</Link>
        </div>
        <FormNC clienteId={id} comprobantes={comprobantes} inicial={factura ?? null} nota={nota} />
      </main>
    </>
  );
}
