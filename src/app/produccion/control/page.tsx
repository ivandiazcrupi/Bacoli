import Link from "next/link";
import { Cabecera } from "@/components/Cabecera";
import { cabeceraTabla } from "@/components/campos";
import { db } from "@/lib/db";
import { aFecha, deFecha, diaMes, esFechaValida, finDeSemana, hoy, inicioSemana, nombreDia, sumarDias } from "@/lib/fechas";
import { PRODUCTOS_PRODUCCION, horaEnteraArg, minutosATexto, resumirProducto } from "@/lib/produccion";
import { focacciasPorTipo, unidadesPorSabor } from "@/lib/ruta";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../../pedidos/Encabezado";
import { EncabezadoProduccion } from "../EncabezadoProduccion";

const num = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);
const dec = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(n);

// CONTROL de producción (solo oficina): cómo viene el día (producido, desperdicio, ritmo por hora, tiempos) y la semana contra lo pedido.
export default async function Control({ searchParams }: { searchParams: Promise<{ fecha?: string }> }) {
  const usuario = await exigirOficina();
  const { fecha: f } = await searchParams;
  const fecha = f && esFechaValida(f) ? f : hoy();
  const ini = inicioSemana(fecha);
  const fin = finDeSemana(ini);

  const [tandasSemana, pedidos] = await Promise.all([
    db.produccion.findMany({ where: { fecha: { gte: aFecha(ini), lte: aFecha(fin) } }, include: { usuario: { select: { nombre: true } } }, orderBy: { creadoEn: "asc" } }),
    db.pedido.findMany({ where: { estado: { not: "CANCELADO" }, origen: { not: "COBRANZA" }, fechaEntrega: { gte: aFecha(ini), lte: aFecha(fin) } }, include: { items: true } }),
  ]);
  const delDia = tandasSemana.filter((t) => deFecha(t.fecha) === fecha);

  // Lo pedido en la semana (mismos conteos que la hoja de ruta).
  const pedido = { TOMATE: 0, CEBOLLA: 0, PIZZA: 0, FOCACCIA_OLIVA: 0, FOCACCIA_CHERRY: 0 };
  for (const p of pedidos) {
    const u = unidadesPorSabor(p.items);
    const x = focacciasPorTipo(p.items);
    pedido.TOMATE += u.tomate; pedido.CEBOLLA += u.cebolla; pedido.PIZZA += u.pizzas; pedido.FOCACCIA_OLIVA += x.oliva; pedido.FOCACCIA_CHERRY += x.cherry;
  }

  const porProducto = PRODUCTOS_PRODUCCION.map((p) => ({
    ...p,
    dia: resumirProducto(delDia.filter((t) => t.producto === p.id)),
    semana: resumirProducto(tandasSemana.filter((t) => t.producto === p.id)),
    pedido: pedido[p.id],
  }));
  const totalDia = porProducto.reduce((s, p) => s + p.dia.producido, 0);
  const despDia = porProducto.reduce((s, p) => s + p.dia.desperdicio, 0);

  // Producido por hora (hora de la carga), para ver cómo va avanzando el día.
  const cerradas = delDia.filter((t) => t.fin);
  const porHora = new Map<number, number>();
  for (const t of cerradas) porHora.set(horaEnteraArg(t.fin!), (porHora.get(horaEnteraArg(t.fin!)) ?? 0) + t.cantidad);
  const horas = [...porHora.keys()];
  const desde = horas.length ? Math.min(...horas) : 6;
  const hasta = horas.length ? Math.max(...horas) : 18;
  const rango = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  const maxHora = Math.max(1, ...porHora.values());
  let acumulado = 0;

  const celda = "px-3 py-2 text-center";
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <EncabezadoProduccion activa="control" oficina />

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href={`/produccion/control?fecha=${sumarDias(fecha, -1)}`} className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-bold">←</Link>
          <p className="min-w-48 text-center text-lg font-bold capitalize">{nombreDia(fecha)} {diaMes(fecha)}{fecha === hoy() && <span className="ml-2 text-xs font-semibold uppercase text-verde-700">hoy</span>}</p>
          <Link href={`/produccion/control?fecha=${sumarDias(fecha, 1)}`} className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-bold">→</Link>
          {fecha !== hoy() && <Link href="/produccion/control" className="text-sm font-medium underline">Ir a hoy</Link>}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Producido", num(totalDia)],
            ["Desperdicio", num(despDia)],
            ["% desperdicio", totalDia + despDia > 0 ? `${dec((despDia / (totalDia + despDia)) * 100)} %` : "—"],
            ["Tandas", String(cerradas.length)],
          ].map(([t, v]) => (
            <div key={t} className="rounded-lg border border-stone-300 bg-white px-4 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{t}</p>
              <p className="mt-1 text-2xl font-bold">{v}</p>
            </div>
          ))}
        </div>

        <section className="overflow-x-auto rounded-lg border border-stone-300 bg-white">
          <h2 className="border-b border-stone-300 bg-stone-50 px-4 py-2 text-sm font-bold uppercase tracking-wide text-stone-600">El día, por producto</h2>
          <table className="w-full min-w-[640px] text-sm">
            <thead className={cabeceraTabla}>
              <tr>{["Producto", "Producido", "Desperdicio", "% desp.", "Tandas", "Unidades por hora", "Tiempo por tanda"].map((h) => <th key={h} className={`${celda} font-semibold`}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {porProducto.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2 font-semibold">{p.nombre}</td>
                  <td className={`${celda} font-bold`}>{num(p.dia.producido)}</td>
                  <td className={`${celda} ${p.dia.desperdicio > 0 ? "font-semibold text-rojo-700" : ""}`}>{num(p.dia.desperdicio)}</td>
                  <td className={celda}>{p.dia.producido + p.dia.desperdicio > 0 ? `${dec(p.dia.pctDesperdicio)} %` : "—"}</td>
                  <td className={celda}>{p.dia.tandas}</td>
                  <td className={celda}>{p.dia.porHora ? dec(p.dia.porHora) : "—"}</td>
                  <td className={celda}>{p.dia.minutosPorTanda ? minutosATexto(p.dia.minutosPorTanda) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-stone-200 px-4 py-2 text-xs text-stone-500">Unidades por hora y tiempo por tanda salen de las tandas donde apretaron <b>Empecé</b> antes de cargar.</p>
        </section>

        <section className="rounded-lg border border-stone-300 bg-white">
          <h2 className="border-b border-stone-300 bg-stone-50 px-4 py-2 text-sm font-bold uppercase tracking-wide text-stone-600">Avance del día, hora por hora</h2>
          {cerradas.length === 0 ? <p className="p-4 text-sm text-stone-500">No hay cargas este día.</p> : (
            <div className="space-y-1.5 p-4">
              {rango.map((h) => {
                const v = porHora.get(h) ?? 0;
                acumulado += v;
                return (
                  <div key={h} className="grid grid-cols-[3.5rem_1fr_9rem] items-center gap-3 text-sm">
                    <span className="font-medium text-stone-600">{String(h).padStart(2, "0")}:00</span>
                    <div className="h-5 rounded bg-stone-100"><div className="h-5 rounded bg-verde-700" style={{ width: `${(v / maxHora) * 100}%` }} /></div>
                    <span className="text-right"><b>{num(v)}</b> <span className="text-stone-500">· van {num(acumulado)}</span></span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="overflow-x-auto rounded-lg border border-stone-300 bg-white">
          <h2 className="border-b border-stone-300 bg-stone-50 px-4 py-2 text-sm font-bold uppercase tracking-wide text-stone-600">Semana {diaMes(ini)} al {diaMes(fin)}: lo pedido contra lo producido</h2>
          <table className="w-full min-w-[640px] text-sm">
            <thead className={cabeceraTabla}>
              <tr>{["Producto", "Pedido", "Producido", "Falta", "Avance", "Desperdicio"].map((h) => <th key={h} className={`${celda} font-semibold`}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {porProducto.map((p) => {
                const falta = p.pedido - p.semana.producido;
                const pct = p.pedido > 0 ? Math.min(100, (p.semana.producido / p.pedido) * 100) : 0;
                return (
                  <tr key={p.id}>
                    <td className="px-3 py-2 font-semibold">{p.nombre}</td>
                    <td className={celda}>{num(p.pedido)}</td>
                    <td className={`${celda} font-bold`}>{num(p.semana.producido)}</td>
                    <td className={`${celda} font-semibold ${falta > 0 ? "text-rojo-700" : "text-verde-700"}`}>{falta > 0 ? num(falta) : falta < 0 ? `+${num(-falta)} de más` : "Completo"}</td>
                    <td className="px-3 py-2"><div className="mx-auto h-3 w-40 rounded bg-stone-100"><div className="h-3 rounded bg-verde-700" style={{ width: `${pct}%` }} /></div></td>
                    <td className={celda}>{num(p.semana.desperdicio)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="border-t border-stone-200 px-4 py-2 text-xs text-stone-500">«Pedido» = lo que hay para entregar en la semana (martes a lunes, sin cancelados), en unidades. «Producido» = lo cargado en esos mismos días.</p>
        </section>
      </main>
    </>
  );
}
