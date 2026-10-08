import Link from "next/link";
import { notFound } from "next/navigation";
import { Cabecera } from "@/components/Cabecera";
import { db } from "@/lib/db";
import { exigirOficina } from "@/lib/session";
import { actualizarCliente, cambiarActivoCliente, guardarPreciosEspeciales } from "../actions";
import { formatoPesos } from "@/lib/numeros";
import { EliminarCliente } from "../EliminarCliente";
import { UnirClientes } from "../UnirClientes";
import { ClienteForm, type DatosCliente } from "../ClienteForm";
import { PreciosEspeciales, type FilaPrecio } from "../PreciosEspeciales";
import { EncabezadoSucursales, FilaSucursal } from "../SucursalForm";
import { BotonVolver } from "@/components/BotonVolver";

const MOSTRAR_PRECIOS_PROPIOS = Boolean(process.env.MOSTRAR_PRECIOS_PROPIOS);

export default async function FichaCliente({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await exigirOficina();
  const { id } = await params;
  const cliente = await db.cliente.findUnique({
    where: { id },
    include: {
      puntos: { include: { zona: true }, orderBy: { direccion: "asc" } },
      preciosEspeciales: true,
      listaPrecios: { include: { precios: true } },
    },
  });
  if (!cliente) notFound();
  const [nPedidos, nMovimientos, nNotas] = await Promise.all([db.pedido.count({ where: { clienteId: id } }), db.movimientoCuenta.count({ where: { clienteId: id } }), db.notaCredito.count({ where: { clienteId: id } })]);
  const resumenUnion = `${cliente.puntos.length} sucursal(es), ${nPedidos} pedido(s), ${nMovimientos} movimiento(s) de cuenta, ${nNotas} nota(s) de crédito`;

  const [listas, zonas, barrios, productos] = await Promise.all([
    db.listaPrecios.findMany({ where: { OR: [{ activa: true }, { id: cliente.listaPreciosId ?? "" }] }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
    db.zona.findMany({ orderBy: { orden: "asc" } }),
    db.puntoEntrega.findMany({ distinct: ["barrio"], select: { barrio: true }, orderBy: { barrio: "asc" } }),
    db.producto.findMany({ where: { activo: true }, orderBy: [{ orden: "asc" }, { nombre: "asc" }] }),
  ]);
  const filasPrecios: FilaPrecio[] = productos.map((p) => {
    const propio = cliente.preciosEspeciales.find((x) => x.productoId === p.id);
    const deLista = cliente.listaPrecios?.precios.find((x) => x.productoId === p.id);
    const descuento = Number(cliente.descuentoPct);
    let textoVacio: string;
    if (deLista) {
      const final = Number(deLista.precio) * (1 - descuento / 100);
      textoVacio = `Sin precio propio: paga ${formatoPesos(final)} por ${p.unidad} (lista ${cliente.listaPrecios!.nombre}${descuento ? ` con ${descuento}% de descuento` : ""}).`;
    } else textoVacio = cliente.listaPrecios ? `Su lista (${cliente.listaPrecios.nombre}) no tiene precio para este producto.` : "Sin lista asignada.";
    return {
      productoId: p.id,
      nombre: `${p.sku ? `${p.sku} · ` : ""}${p.nombre}`,
      especial: propio ? String(propio.precio).replace(".", ",") : "",
      textoVacio,
      textoLleno: `Paga este precio por ${p.unidad} (final, sin descuento encima).`,
    };
  });
  const listaBarrios = barrios.map((b) => b.barrio);

  const inicial: DatosCliente = {
    nombre: cliente.nombre,
    tipo: cliente.tipo,
    razonSocial: cliente.razonSocial ?? "",
    cuit: cliente.cuit ?? "",
    facturado: cliente.facturado,
    condicionPago: cliente.condicionPago,
    listaPreciosId: cliente.listaPreciosId ?? "",
    descuentoPct: Number(cliente.descuentoPct) ? String(cliente.descuentoPct).replace(".", ",") : "",
    imputacionPago: cliente.imputacionPago,
    sinLimite: cliente.sinLimite,
    maxPedidosImpagos: cliente.maxPedidosImpagos?.toString() ?? "",
    maxMonto: cliente.maxMonto?.toString().replace(".", ",") ?? "",
    comisionista: cliente.comisionista ?? "",
    comisionPct: cliente.comisionPct?.toString().replace(".", ",") ?? "",
    observacion: cliente.observacion ?? "",
  };

  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-stone-300 bg-white p-5 text-stone-900">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{cliente.nombre}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
              <span className={`rounded-full px-3 py-1 ${cliente.activo ? "bg-verde-50 text-verde-800" : "bg-rojo-100 text-rojo-800"}`}>{cliente.activo ? "Cliente activo" : "Cliente desactivado"}</span>
              <span className="rounded-full bg-crema-200 px-3 py-1 text-stone-700">{cliente.puntos.length} {cliente.puntos.length === 1 ? "sucursal" : "sucursales"}</span>
              
            </div>
            {cliente.observacion && (
              <p className="mt-3 max-w-3xl whitespace-pre-line rounded-md border border-rojo-200 bg-rojo-50 px-3 py-2 text-sm font-medium text-rojo-800"><span className="mr-1.5 font-bold uppercase">Importante:</span>{cliente.observacion}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/cuentas/${cliente.id}`} className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold uppercase text-stone-800 hover:bg-crema-100">Cuenta corriente</Link>
            <Link href={`/clientes/${cliente.id}/pedidos`} className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold uppercase text-stone-800 hover:bg-crema-100">Pedidos</Link>
            <form action={cambiarActivoCliente}>
              <input type="hidden" name="id" value={cliente.id} />
              <button className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-crema-100">{cliente.activo ? "Desactivar" : "Activar"}</button>
            </form>
            {usuario.rol === "DUENO" && <UnirClientes id={cliente.id} nombre={cliente.nombre} resumen={resumenUnion} />}
            {usuario.rol === "DUENO" && <EliminarCliente id={cliente.id} nombre={cliente.nombre} />}
            <BotonVolver fallback="/clientes" />
          </div>
        </div>

        <section className="space-y-3">
          <ClienteForm accion={actualizarCliente.bind(null, cliente.id)} inicial={inicial} listas={listas} textoBoton="Guardar cambios" />
        </section>

        {cliente.preciosEspeciales.length > 0 && MOSTRAR_PRECIOS_PROPIOS && ( // los precios propios no se usan por ahora (el precio se escribe en cada pedido)
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Precios propios anteriores</h2>
          <p className="text-sm text-stone-600">
            Este cliente tiene precios propios cargados antes. Siguen valiendo. Hoy se prefiere usar una lista de precios o un descuento: para dejar de usarlos, vaciá el precio y guardá.
          </p>
          <PreciosEspeciales accion={guardarPreciosEspeciales.bind(null, cliente.id)} filas={filasPrecios} pie="Precio sin IVA, por la unidad de venta de cada producto. Vale para todas las sucursales del cliente." />
        </section>
        )}

        <section className="space-y-3">
          <h2 className="pt-4 text-center text-3xl font-bold tracking-tight">Sucursales <span className="text-verde-700">({cliente.puntos.length})</span></h2>
          <div className="overflow-hidden rounded-xl border-2 border-stone-300 bg-white shadow-sm">
            <EncabezadoSucursales />
            {cliente.puntos.map((p) => (
              <FilaSucursal
                key={p.id}
                clienteId={cliente.id}
                zonas={zonas}
                barrios={listaBarrios}
                sucursal={{ id: p.id, alias: p.alias ?? "", direccion: p.direccion, barrio: p.barrio, zonaId: p.zonaId, telefono: p.telefono ?? "", comentario: p.comentario ?? "", cuit: p.cuit ?? "", activo: p.activo }}
              />
            ))}
            <FilaSucursal clienteId={cliente.id} zonas={zonas} barrios={listaBarrios} />
          </div>
        </section>
      </main>
    </>
  );
}
