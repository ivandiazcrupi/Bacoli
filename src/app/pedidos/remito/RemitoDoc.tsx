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
  items: { sku: string | null; descripcion: string; cantidad: number; unidad: string; precioUnitario: number; precioLista?: number }[]; // precioUnitario ya viene con la bonificación; precioLista es el precio sin descontar
};


// Dato con su rótulo chico arriba (todos los cuadros usan el mismo molde).
const Campo = ({ rotulo, valor, clase = "" }: { rotulo: string; valor: string | null | undefined; clase?: string }) => (
  <div className={`flex h-[11mm] flex-col justify-center px-2 ${clase}`}>
    <span className="text-[6.5pt] uppercase leading-none tracking-wide">{rotulo}</span>
    <span className="mt-1 truncate leading-none">{valor || "\u00a0"}</span>
  </div>
);

// Remito en A4, solo blanco y negro. Un único tamaño de letra (9 pt) y un solo molde de cuadro: todo parejo.
// Documento de entrega: no reemplaza a la factura.
export function RemitoDoc({ empresa, r }: { empresa: Empresa | null; r: DatosRemito }) {
  const total = r.items.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0);
  const bruto = r.items.reduce((s, i) => s + i.cantidad * (i.precioLista ?? i.precioUnitario), 0);
  const descuento = Math.round((bruto - total) * 100) / 100;
  const celda = "flex h-full items-center border-r border-black px-2";
  const ultima = "flex h-full items-center px-2";
  const columnas = "22mm 1fr 20mm 22mm 26mm 28mm";
  const fila = "grid h-[7mm] items-center border-b border-black";
  return (
    <article className="mx-auto flex min-h-[297mm] w-[210mm] flex-col gap-[3mm] rounded-none bg-white p-[10mm] text-[9pt] leading-none text-black print:min-h-0 print:h-[296mm] print:overflow-hidden print:p-[8mm]">
      {/* Encabezado */}
      <header className="grid grid-cols-[1fr_20mm_1fr] border border-black">
        <div className="flex flex-col justify-center gap-1.5 p-2.5">
          <p className="text-[12pt] font-bold">{empresa?.nombreComercial || "BACOLI"}</p>
          <p>{empresa?.razonSocial}</p>
          <p>{empresa?.domicilio}</p>
          <p>{[empresa?.telefono && `Tel. ${empresa.telefono}`, empresa?.email].filter(Boolean).join(" · ")}</p>
          <p>{empresa?.condicionIva && `IVA ${empresa.condicionIva}`}</p>
          {!empresa?.razonSocial && <p className="text-rojo-700 print:hidden">Faltan los datos de la empresa (menú Empresa).</p>}
        </div>
        <div className="flex flex-col items-center justify-between border-x border-black py-2 text-center">
          <span className="text-[22pt] font-bold">X</span>
          <span className="px-1 text-[6.5pt] uppercase leading-tight">Documento no válido como factura</span>
        </div>
        <div className="flex flex-col items-center justify-center gap-1.5 p-2.5 text-center">
          <p className="text-[12pt] font-bold">REMITO N° {formatoRemito(r.numero)}</p>
          <p>Fecha: {diaMes(r.fecha)}/{r.fecha.slice(0, 4)}</p>
          {empresa?.cuit && <p>CUIT {empresa.cuit}</p>}
          {empresa?.ingresosBrutos && <p>Ing. Brutos {empresa.ingresosBrutos}</p>}
          {empresa?.inicioActividades && <p>Inicio de actividades {empresa.inicioActividades}</p>}
        </div>
      </header>

      {/* Cliente */}
      <section className="border border-black">
        <Campo rotulo="Señor/es" valor={r.cliente.razonSocial && r.cliente.razonSocial !== r.cliente.nombre ? `${r.cliente.nombre} · ${r.cliente.razonSocial}` : r.cliente.nombre} clase="border-b border-black" />
        <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr]">
          <Campo rotulo="Domicilio" valor={titulo(r.sucursal.direccion)} clase="border-r border-black" />
          <Campo rotulo="Localidad" valor={titulo(r.sucursal.barrio)} clase="border-r border-black" />
          <Campo rotulo="CUIT" valor={r.cliente.cuit} clase="border-r border-black" />
          <Campo rotulo="Teléfono" valor={r.sucursal.telefono} />
        </div>
      </section>

      {/* Detalle: solo se rayan los renglones que se usan; el resto queda en blanco */}
      <section className="flex flex-1 flex-col border border-black">
        <div className={`${fila} text-[7pt] font-bold uppercase tracking-wide`} style={{ gridTemplateColumns: columnas }}>
          <span className={celda}>Código</span>
          <span className={celda}>Descripción</span>
          <span className={`${celda} justify-center`}>Cantidad</span>
          <span className={`${celda} justify-center`}>Unidad</span>
          <span className={`${celda} justify-end`}>Precio</span>
          <span className={`${ultima} justify-end`}>Importe</span>
        </div>
        {r.items.map((i, n) => (
          <div key={n} className={fila} style={{ gridTemplateColumns: columnas }}>
            <span className={`${celda} truncate`}>{i.sku ?? ""}</span>
            <span className={`${celda} truncate`}>{i.descripcion}</span>
            <span className={`${celda} justify-center tabular-nums`}>{i.cantidad}</span>
            <span className={`${celda} justify-center`}>{i.unidad === "paquete" ? (i.cantidad === 1 ? "paquete" : "paquetes") : i.cantidad === 1 ? "unidad" : "unidades"}</span>
            <span className={`${celda} justify-end tabular-nums`}>{formatoPesos(i.precioUnitario)}</span>
            <span className={`${ultima} justify-end tabular-nums`}>{formatoPesos(i.cantidad * i.precioUnitario)}</span>
          </div>
        ))}
        <div className="flex-1" />

        {/* Totales: si hay bonificación se ve el descuento; el total va grande */}
        <div className="ml-auto w-[80mm] border-l border-t border-black">
          {descuento > 0.004 && (
            <>
              <div className="flex h-[6.5mm] items-center justify-between border-b border-black px-3"><span>Subtotal</span><span className="tabular-nums">{formatoPesos(bruto)}</span></div>
              <div className="flex h-[6.5mm] items-center justify-between border-b border-black px-3"><span>Bonificación</span><span className="tabular-nums">−{formatoPesos(descuento)}</span></div>
            </>
          )}
          <div className="flex h-[12mm] items-center justify-between px-3"><span className="text-[8pt] font-bold uppercase tracking-wide">Total</span><span className="text-[16pt] font-bold tabular-nums">{formatoPesos(total)}</span></div>
        </div>
      </section>

      {/* Observaciones (a mano) y firma */}
      <footer className="flex gap-[3mm]">
        <div className="h-[20mm] flex-1 border border-black p-1.5 text-[6.5pt] uppercase tracking-wide">Observaciones</div>
        <div className="flex h-[20mm] w-[70mm] items-end justify-center border border-black pb-1.5 text-[6.5pt] uppercase tracking-wide">Firma</div>
      </footer>
    </article>
  );
}
