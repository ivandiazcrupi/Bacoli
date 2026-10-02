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

const fila = (etiqueta: string, valor: string | null | undefined) => (valor ? <p><span className="text-black">{etiqueta} </span>{valor}</p> : null);
const LINEAS_MIN = 18; // el cuerpo se completa con renglones vacíos, como un remito impreso

// Remito en A4 con el formato de un remito comercial: encabezado con la letra X, datos del cliente en cuadro,
// detalle en tabla con renglones y recuadros de firma. Documento de entrega: no reemplaza a la factura.
export function RemitoDoc({ empresa, r, conPrecios }: { empresa: Empresa | null; r: DatosRemito; conPrecios: boolean }) {
  const total = r.items.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0);
  const vacias = Math.max(0, LINEAS_MIN - r.items.length);
  const col = "border-r border-black px-2";
  return (
    <article className="mx-auto flex min-h-[297mm] w-[210mm] flex-col gap-2 bg-white p-[10mm] text-[9.5pt] leading-tight text-black print:min-h-0 print:h-[296mm] print:overflow-hidden print:p-[8mm]">
      {/* Encabezado: empresa | letra X | datos del remito */}
      <header className="grid grid-cols-[1fr_22mm_1fr] border-2 border-black">
        <div className="space-y-0.5 p-3 text-[9pt]">
          <p className="text-xl font-extrabold tracking-wide">{empresa?.nombreComercial || "BACOLI"}</p>
          {fila("", empresa?.razonSocial)}
          {fila("", empresa?.domicilio)}
          {fila("Tel.", empresa?.telefono)}
          {fila("", empresa?.email)}
          {fila("IVA", empresa?.condicionIva)}
          {!empresa?.razonSocial && <p className="text-rojo-700 print:hidden">Faltan los datos de la empresa (menú Empresa).</p>}
        </div>
        <div className="flex flex-col items-center border-x-2 border-black text-center">
          <span className="flex h-[13mm] w-full items-center justify-center border-b-2 border-black text-4xl font-extrabold">X</span>
          <span className="p-1 text-[7pt] font-semibold uppercase leading-tight">Documento no válido como factura</span>
        </div>
        <div className="space-y-0.5 p-3 text-[9pt]">
          <p className="text-xl font-extrabold tracking-wide">REMITO</p>
          <p className="text-base font-bold">N° {formatoRemito(r.numero)}</p>
          <p>Fecha: <span className="font-semibold">{diaMes(r.fecha)}/{r.fecha.slice(0, 4)}</span></p>
          {fila("CUIT", empresa?.cuit)}
          {fila("Ing. Brutos", empresa?.ingresosBrutos)}
          {fila("Inicio de actividades", empresa?.inicioActividades)}
        </div>
      </header>

      {/* Cliente */}
      <section className="border border-black text-[10pt]">
        <div className="grid grid-cols-[28mm_1fr] border-b border-black">
          <p className="border-r border-black px-2 py-1 font-semibold">Señor/es</p>
          <p className="px-2 py-1 text-[10.5pt] font-bold">{r.cliente.nombre}{r.cliente.razonSocial && r.cliente.razonSocial !== r.cliente.nombre ? ` · ${r.cliente.razonSocial}` : ""}</p>
        </div>
        <div className="grid grid-cols-[28mm_1fr_22mm_42mm] border-b border-black">
          <p className="border-r border-black px-2 py-1 font-semibold">Domicilio</p>
          <p className="border-r border-black px-2 py-1">{titulo(r.sucursal.direccion)}{r.sucursal.alias ? ` (${titulo(r.sucursal.alias)})` : ""}</p>
          <p className="border-r border-black px-2 py-1 font-semibold">Localidad</p>
          <p className="px-2 py-1">{titulo(r.sucursal.barrio)}</p>
        </div>
        <div className="grid grid-cols-[28mm_1fr_22mm_42mm]">
          <p className="border-r border-black px-2 py-1 font-semibold">CUIT</p>
          <p className="border-r border-black px-2 py-1">{r.cliente.cuit ?? ""}</p>
          <p className="border-r border-black px-2 py-1 font-semibold">Teléfono</p>
          <p className="px-2 py-1">{r.sucursal.telefono ?? ""}</p>
        </div>
      </section>

      {/* Detalle */}
      <table className="w-full flex-1 border-collapse border border-black text-[10pt]">
        <thead>
          <tr className="border-b border-black text-left text-[8.5pt] uppercase tracking-wide">
            <th className={`${col} w-[22mm] py-1`}>Código</th>
            <th className={`${col} py-1`}>Descripción</th>
            <th className={`${col} w-[20mm] py-1 text-center`}>Cantidad</th>
            <th className={`${conPrecios ? col : "px-2"} w-[24mm] py-1 text-center`}>Unidad</th>
            {conPrecios && <th className={`${col} w-[28mm] py-1 text-right`}>Precio</th>}
            {conPrecios && <th className="w-[30mm] px-2 py-1 text-right">Importe</th>}
          </tr>
        </thead>
        <tbody>
          {r.items.map((i, n) => (
            <tr key={n} className="align-top">
              <td className={`${col} py-1 text-black`}>{i.sku ?? ""}</td>
              <td className={`${col} py-1 font-medium`}>{i.descripcion}</td>
              <td className={`${col} py-1 text-center text-[12pt] font-bold tabular-nums`}>{i.cantidad}</td>
              <td className={`${conPrecios ? col : "px-2"} py-1 text-center`}>{i.unidad === "paquete" ? (i.cantidad === 1 ? "paquete" : "paquetes") : i.cantidad === 1 ? "unidad" : "unidades"}</td>
              {conPrecios && <td className={`${col} py-1 text-right tabular-nums`}>{formatoPesos(i.precioUnitario)}</td>}
              {conPrecios && <td className="px-2 py-1 text-right tabular-nums">{formatoPesos(i.cantidad * i.precioUnitario)}</td>}
            </tr>
          ))}
          {Array.from({ length: vacias }).map((_, n) => (
            <tr key={`v${n}`}>
              <td className={`${col} py-2`}>&nbsp;</td>
              <td className={col} />
              <td className={col} />
              <td className={conPrecios ? col : "px-2"} />
              {conPrecios && <td className={col} />}
              {conPrecios && <td className="px-2" />}
            </tr>
          ))}
          <tr className="h-full"><td className={col} /><td className={col} /><td className={col} /><td className={conPrecios ? col : "px-2"} />{conPrecios && <td className={col} />}{conPrecios && <td className="px-2" />}</tr>
        </tbody>
        {conPrecios && (
          <tfoot>
            <tr className="border-t-2 border-black">
              <td colSpan={5} className="px-2 py-1 text-right text-[10pt] font-semibold uppercase">Total</td>
              <td className="px-2 py-1 text-right text-[12pt] font-bold tabular-nums">{formatoPesos(total)}</td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* Recepción: solo la firma */}
      <footer className="ml-auto w-[70mm]">
        <div className="flex h-[20mm] flex-col justify-end rounded-none border border-black pb-1 text-center text-[8.5pt]">Firma</div>
      </footer>
    </article>
  );
}
