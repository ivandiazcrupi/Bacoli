import type { Empresa } from "@prisma/client";
import { IVA_PCT } from "@/lib/cuenta";
import { diaMes, nombreDia } from "@/lib/fechas";
import { titulo } from "@/lib/mayusculas";
import { formatoPesos } from "@/lib/numeros";
import { formatoRemito } from "@/lib/remito";

export type DatosRemito = {
  numero: number;
  fecha: string; // día de entrega "AAAA-MM-DD" o de emisión
  conFactura: boolean;
  numeroFactura: string | null;
  nota: string | null;
  cliente: { nombre: string; razonSocial: string | null; cuit: string | null };
  sucursal: { alias: string | null; direccion: string; barrio: string; telefono: string | null };
  items: { sku: string | null; descripcion: string; cantidad: number; unidad: string; precioUnitario: number }[];
};

const fila = (etiqueta: string, valor: string | null | undefined) => (valor ? <p><span className="text-stone-500">{etiqueta} </span>{valor}</p> : null);

// Un remito en tamaño A4, listo para imprimir. Documento de entrega: no reemplaza a la factura.
export function RemitoDoc({ empresa, r, conPrecios }: { empresa: Empresa | null; r: DatosRemito; conPrecios: boolean }) {
  const subtotal = r.items.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0);
  const iva = r.conFactura ? subtotal * (IVA_PCT / 100) : 0;
  return (
    <article className="mx-auto flex min-h-[297mm] w-[210mm] flex-col bg-white p-[12mm] text-[11pt] leading-snug text-black print:min-h-0 print:h-[296mm] print:overflow-hidden print:p-[10mm]">
      <header className="grid grid-cols-[1fr_auto] gap-6 border-b-2 border-black pb-4">
        <div className="space-y-0.5 text-[10pt]">
          <p className="text-2xl font-bold">{empresa?.nombreComercial || "BACOLI"}</p>
          {fila("", empresa?.razonSocial)}
          {fila("", empresa?.domicilio)}
          {fila("CUIT", empresa?.cuit)}
          {fila("IVA", empresa?.condicionIva)}
          {fila("Ing. Brutos", empresa?.ingresosBrutos)}
          {fila("Inicio de actividades", empresa?.inicioActividades)}
          {fila("Tel.", empresa?.telefono)}
          {fila("", empresa?.email)}
          {!empresa?.razonSocial && <p className="text-rojo-700 print:hidden">Faltan los datos de la empresa (menú Empresa).</p>}
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold tracking-wide">REMITO</p>
          <p className="text-xl font-semibold">N° {formatoRemito(r.numero)}</p>
          <p className="mt-2 text-[10pt]">Fecha: {nombreDia(r.fecha)} {diaMes(r.fecha)}/{r.fecha.slice(0, 4)}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-6 border-b border-stone-400 py-4 text-[10.5pt]">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Cliente</p>
          <p className="text-lg font-bold">{r.cliente.nombre}</p>
          {fila("Razón social", r.cliente.razonSocial)}
          {fila("CUIT", r.cliente.cuit)}
        </div>
        <div className="space-y-0.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Entregar en</p>
          {r.sucursal.alias && <p className="font-semibold">{titulo(r.sucursal.alias)}</p>}
          <p className="text-lg font-bold">{titulo(r.sucursal.direccion)}</p>
          {titulo(r.sucursal.barrio) !== titulo(r.sucursal.alias) && <p>{titulo(r.sucursal.barrio)}</p>}
          {fila("Tel.", r.sucursal.telefono)}
        </div>
      </section>

      <table className="mt-4 w-full border-collapse text-[10.5pt]">
        <thead>
          <tr className="border-b-2 border-black text-left text-xs uppercase tracking-wide">
            <th className="w-20 py-1.5">Código</th>
            <th className="py-1.5">Descripción</th>
            <th className="w-20 py-1.5 text-right">Cantidad</th>
            <th className="w-20 py-1.5 pl-3">Unidad</th>
            {conPrecios && <th className="w-28 py-1.5 text-right">Precio</th>}
            {conPrecios && <th className="w-28 py-1.5 text-right">Importe</th>}
          </tr>
        </thead>
        <tbody>
          {r.items.map((i, n) => (
            <tr key={n} className="border-b border-stone-300 align-top">
              <td className="py-2 text-stone-600">{i.sku ?? ""}</td>
              <td className="py-2 font-medium">{i.descripcion}</td>
              <td className="py-2 text-right text-lg font-bold tabular-nums">{i.cantidad}</td>
              <td className="py-2 pl-3">{i.unidad === "paquete" ? (i.cantidad === 1 ? "paquete" : "paquetes") : i.cantidad === 1 ? "unidad" : "unidades"}</td>
              {conPrecios && <td className="py-2 text-right tabular-nums">{formatoPesos(i.precioUnitario)}</td>}
              {conPrecios && <td className="py-2 text-right tabular-nums">{formatoPesos(i.cantidad * i.precioUnitario)}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      {conPrecios && (
        <div className="mt-3 ml-auto w-64 space-y-0.5 text-[10.5pt]">
          {r.conFactura && <p className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatoPesos(subtotal)}</span></p>}
          {r.conFactura && <p className="flex justify-between"><span>IVA {String(IVA_PCT).replace(".", ",")}%</span><span className="tabular-nums">{formatoPesos(iva)}</span></p>}
          <p className="flex justify-between border-t border-black pt-1 text-lg font-bold"><span>Total</span><span className="tabular-nums">{formatoPesos(subtotal + iva)}</span></p>
        </div>
      )}

      {(r.nota || (r.conFactura && r.numeroFactura)) && (
        <div className="mt-4 space-y-0.5 text-[10pt]">
          {r.conFactura && r.numeroFactura && <p><span className="text-stone-500">Factura N° </span>{r.numeroFactura}</p>}
          {r.nota && <p><span className="text-stone-500">Nota: </span>{r.nota}</p>}
        </div>
      )}

      <footer className="mt-auto space-y-3 pt-10">
        <div className="grid grid-cols-3 gap-8 text-center text-[10pt]">
          {["Firma", "Aclaración", "Fecha de recepción"].map((t) => (
            <div key={t} className="border-t border-black pt-1">{t}</div>
          ))}
        </div>
        <p className="text-center text-[9pt] text-stone-600">Documento no válido como factura.</p>
      </footer>
    </article>
  );
}
