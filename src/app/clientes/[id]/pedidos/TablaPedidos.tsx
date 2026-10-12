"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatoPesos } from "@/lib/numeros";
import { CABECERA_TABLA } from "@/app/cuentas/estilo";
import { FiltroLista, SEP } from "@/app/cuentas/FiltroLista";
import { coincideNumero } from "@/lib/filtroNumero";

export type FilaPedido = {
  id: string;
  cargado: string; // AAAA-MM-DD
  entrega: string | null; // AAAA-MM-DD
  barrio: string;
  direccion: string;
  items: { cantidad: number; nombre: string; sinCargo: number }[];
  monto: number;
  comprobante: string; // "F-4818", "R-0001" o ""
  comprobanteFalta: string; // "Factura sin número" / "Remito sin emitir"
  estado: "PENDIENTE" | "ENTREGADO" | "NO_ENTREGADO" | "CANCELADO";
  pagado: boolean;
  medio: string | null;
  aCuenta: boolean; // entregado y quedó en cuenta corriente
};

const COLUMNAS = "grid-cols-[100px_100px_minmax(250px,1.7fr)_minmax(230px,1.7fr)_112px_100px_112px_168px_72px]";
const ESTADOS = { PENDIENTE: "Pendiente", ENTREGADO: "Entregado", NO_ENTREGADO: "No entregado", CANCELADO: "Cancelado" } as const;
const MEDIOS: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", CHEQUE: "Cheque", MERCADO_PAGO: "Mercado Pago", OTRO: "Otro" };
// Pastillas clarísimas con texto en negrita, como en Cuenta corriente: verde = bien, rojo = problema, amarillo suave = en espera.
const PASTILLA_ESTADO = { PENDIENTE: "bg-[#fdf8e3] text-[#8a6a05]", ENTREGADO: "bg-verde-50 text-verde-700", NO_ENTREGADO: "bg-rojo-50 text-rojo-700", CANCELADO: "bg-rojo-50 text-rojo-700" } as const;
const pastilla = "inline-flex h-7 items-center whitespace-nowrap rounded-full px-3 text-[12.5px] font-bold";
const fecha = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "");

type Col = "cargado" | "entrega" | "sucursal" | "monto" | "estado";

// Historial de pedidos del cliente en una hoja: fecha completa (dd/mm/aaaa), orden al tocar el título y filtros rápidos.
const textoPago = (f: FilaPedido) => (f.pagado ? "Pagado" : f.estado === "ENTREGADO" ? "Pendiente" : "Sin entregar");
const textoSucursal = (f: FilaPedido) => (f.barrio || f.direccion ? `${f.barrio} · ${f.direccion}` : "—");
const entradaFiltro = "h-7 w-full min-w-0 rounded border border-stone-300 bg-white px-1.5 text-center text-[12px] font-normal normal-case tracking-normal text-stone-800 placeholder:text-stone-300 focus:border-verde-700 focus:outline-none";

export function TablaPedidos({ filas }: { filas: FilaPedido[] }) {
  const [orden, setOrden] = useState<{ col: Col; asc: boolean }>({ col: "cargado", asc: false });
  // Filtros arriba de cada columna (como en Cuenta corriente): los de lista permiten elegir varios.
  const [fCargado, setFCargado] = useState("");
  const [fEntrega, setFEntrega] = useState("");
  const [fSucursal, setFSucursal] = useState("");
  const [fPedido, setFPedido] = useState("");
  const [fMonto, setFMonto] = useState("");
  const [fComprobante, setFComprobante] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fPago, setFPago] = useState("");
  const hayFiltros = !!(fCargado.trim() || fEntrega.trim() || fSucursal || fPedido.trim() || fMonto.trim() || fComprobante.trim() || fEstado || fPago);
  const quitar = () => { setFCargado(""); setFEntrega(""); setFSucursal(""); setFPedido(""); setFMonto(""); setFComprobante(""); setFEstado(""); setFPago(""); };
  const sucursales = useMemo(() => [...new Set(filas.map(textoSucursal))].sort((a, b) => a.localeCompare(b, "es")), [filas]);

  const visibles = useMemo(() => {
    const incluye = (texto: string, v: string) => !v.trim() || texto.toLowerCase().includes(v.trim().toLowerCase());
    const r = filas.filter((f) =>
      incluye(fecha(f.cargado), fCargado) && incluye(f.entrega ? fecha(f.entrega) : "Sin día", fEntrega) &&
      (!fSucursal || fSucursal.split(SEP).includes(textoSucursal(f))) &&
      incluye(f.items.map((i) => `${i.cantidad} ${i.nombre}`).join(" "), fPedido) && coincideNumero(f.monto, fMonto) &&
      incluye(f.comprobante || f.comprobanteFalta, fComprobante) &&
      (!fEstado || fEstado.split(SEP).includes(ESTADOS[f.estado])) && (!fPago || fPago.split(SEP).includes(textoPago(f))));
    const clave = (f: FilaPedido): string | number => orden.col === "cargado" ? f.cargado : orden.col === "entrega" ? f.entrega ?? "9999-99-99" : orden.col === "sucursal" ? `${f.barrio} ${f.direccion}`.toLowerCase() : orden.col === "monto" ? f.monto : ESTADOS[f.estado];
    return [...r].sort((a, b) => { const x = clave(a), y = clave(b); return (x < y ? -1 : x > y ? 1 : 0) * (orden.asc ? 1 : -1) || b.cargado.localeCompare(a.cargado); });
  }, [filas, orden, fCargado, fEntrega, fSucursal, fPedido, fMonto, fComprobante, fEstado, fPago]);

  const titulo = (col: Col, texto: string) => (
    <button type="button" onClick={() => setOrden((o) => ({ col, asc: o.col === col ? !o.asc : col === "sucursal" || col === "estado" }))} className="flex items-center justify-center gap-1 uppercase hover:text-stone-900">
      {texto}{orden.col === col && <span className="text-verde-700">{orden.asc ? "▲" : "▼"}</span>}
    </button>
  );
  const texto = (valor: string, set: (v: string) => void, nombre: string, ejemplo: string) => <input aria-label={`Filtrar ${nombre}`} value={valor} onChange={(e) => set(e.target.value)} placeholder={ejemplo} className={entradaFiltro} />;

  return (
    <div className="rounded-lg border border-stone-300 bg-white">
      <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 px-4 py-2 text-[13px] text-stone-600">
        <span>{visibles.length} {visibles.length === 1 ? "pedido" : "pedidos"}{hayFiltros ? ` de ${filas.length}` : ""}</span>
        {hayFiltros && <button type="button" onClick={quitar} className="rounded-full border border-stone-300 bg-white px-3 py-0.5 text-[12.5px] font-semibold text-stone-700 hover:border-stone-600">Quitar filtros ✕</button>}
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[1300px]">
          <div className="border-b border-stone-300 bg-crema-100">
            <div className={`grid items-center gap-x-3 px-4 pt-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-500 ${COLUMNAS}`}>
              {titulo("cargado", "Cargado")}{titulo("entrega", "Entrega")}{titulo("sucursal", "Sucursal")}<span>Pedido</span>{titulo("monto", "Monto")}<span>Comprobante</span>{titulo("estado", "Estado")}<span>Pago</span><span />
            </div>
            <div className={`grid items-center gap-x-3 px-4 pb-2.5 pt-1.5 ${COLUMNAS}`}>
              {texto(fCargado, setFCargado, "fecha de carga", "Ej: 12/10")}
              {texto(fEntrega, setFEntrega, "fecha de entrega", "Ej: 16/10")}
              <FiltroLista varios titulo="Sucursal" opciones={sucursales} valor={fSucursal} onCambio={setFSucursal} />
              {texto(fPedido, setFPedido, "pedido", "Ej: tomate")}
              {texto(fMonto, setFMonto, "monto", "Ej: >200000")}
              {texto(fComprobante, setFComprobante, "comprobante", "Ej: F-49")}
              <FiltroLista varios titulo="Estado" opciones={Object.values(ESTADOS)} valor={fEstado} onCambio={setFEstado} />
              <FiltroLista varios titulo="Pago" opciones={["Pagado", "Pendiente", "Sin entregar"]} valor={fPago} onCambio={setFPago} />
              <span />
            </div>
          </div>
          {visibles.length === 0 && <p className="p-8 text-center text-sm text-stone-500">No hay pedidos con esos filtros.</p>}
          {visibles.map((f) => {
            const cancelado = f.estado === "CANCELADO";
            const vistos = f.items.length > 2 ? f.items.slice(0, 1) : f.items; // con 3 o más renglones: el primero y "+N más"
            return (
              <div key={f.id} className={`grid h-14 items-center gap-x-3 overflow-hidden border-b border-stone-200 px-4 text-center text-[13.5px] text-stone-800 hover:bg-crema-50 ${COLUMNAS} ${cancelado ? "text-stone-400" : ""}`}>
                <span className="tabular-nums text-stone-700">{fecha(f.cargado)}</span>
                <span className="tabular-nums text-stone-700">{f.entrega ? fecha(f.entrega) : <span className="text-stone-400">Sin día</span>}</span>
                <span className="min-w-0 text-left leading-tight" title={`${f.barrio} · ${f.direccion}`}>
                  {f.barrio || f.direccion ? <>
                    <span className="block truncate font-bold text-stone-800">{f.barrio}</span>
                    <span className="block truncate text-[12.5px] text-stone-600">{f.direccion}</span>
                  </> : <span className="text-stone-300">—</span>}
                </span>
                <span className="min-w-0 text-left leading-tight" title={f.items.map((i) => `${i.cantidad} ${i.nombre}${i.sinCargo ? ` (${i.sinCargo} sin cargo)` : ""}`).join("\n")}>
                  {vistos.map((i, k) => (
                    <span key={k} className="flex items-baseline gap-2 truncate"><b className="min-w-[2.2rem] text-right tabular-nums text-stone-900">{i.cantidad}</b><span className="truncate text-[12.5px]">{i.nombre}{i.sinCargo > 0 && <span className="text-stone-400"> (+{i.sinCargo} sin cargo)</span>}</span></span>
                  ))}
                  {f.items.length > 2 && <span className="block pl-[2.7rem] text-[12px] font-semibold text-stone-500">+ {f.items.length - 1} productos más</span>}
                </span>
                <span className={`font-bold tabular-nums ${cancelado ? "line-through" : ""}`}>{formatoPesos(f.monto)}</span>
                <span className="font-semibold tabular-nums">{f.comprobante || <span className="text-xs font-normal text-stone-400">{f.comprobanteFalta}</span>}</span>
                <span><span className={`${pastilla} ${PASTILLA_ESTADO[f.estado]}`}>{ESTADOS[f.estado]}</span></span>
                <span>
                  {f.pagado ? <span className={`${pastilla} bg-verde-50 text-verde-700`}>Pagado{f.medio ? ` · ${MEDIOS[f.medio] ?? ""}` : ""}</span>
                    : f.estado === "ENTREGADO" ? <span className={`${pastilla} bg-rojo-50 text-rojo-700`}>Pendiente</span>
                    : <span className="text-stone-300">—</span>}
                </span>
                <Link href={`/pedidos/${f.id}`} className="inline-flex h-8 items-center justify-center rounded-md border border-stone-300 bg-white px-2.5 text-[12.5px] font-semibold text-stone-700 hover:border-stone-700 hover:bg-stone-800 hover:text-white">Abrir ›</Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
