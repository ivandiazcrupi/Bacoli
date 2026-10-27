import { Cabecera } from "@/components/Cabecera";
import { aFecha, hoy } from "@/lib/fechas";
import { db } from "@/lib/db";
import { esPersonalDeOficina } from "@/lib/roles";
import { exigirProduccion } from "@/lib/session";
import { PRODUCTOS_PRODUCCION } from "@/lib/produccion";
import { EncabezadoProduccion } from "./EncabezadoProduccion";
import { Tarjetas } from "./Tarjetas";

// Cargar la producción del día desde el celular (Gastón y Federico): una tarjeta por producto.
export default async function Produccion() {
  const usuario = await exigirProduccion();
  const oficina = esPersonalDeOficina(usuario.rol);
  const tandas = await db.produccion.findMany({ where: { fecha: aFecha(hoy()) }, include: { usuario: { select: { nombre: true } } }, orderBy: { creadoEn: "asc" } });
  const filas = tandas.map((t) => ({
    id: t.id, producto: t.producto, cantidad: t.cantidad, desperdicio: t.desperdicio,
    inicio: t.inicio?.toISOString() ?? null, fin: t.fin?.toISOString() ?? null,
    quien: t.usuario.nombre, puedeBorrar: oficina || t.usuarioId === usuario.id,
  }));
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5">
        <EncabezadoProduccion activa="cargar" oficina={oficina} />
        <p className="text-sm text-stone-600">Cargá lo que se produjo en <b>unidades</b> (un paquete de prepizza = 2 unidades). Apretá <b>Empecé</b> al arrancar una tanda y al terminar cargá las cantidades: así se mide cuánto tarda.</p>
        <Tarjetas productos={[...PRODUCTOS_PRODUCCION]} tandas={filas} />
      </main>
    </>
  );
}
