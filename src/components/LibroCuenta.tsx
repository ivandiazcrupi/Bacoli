import type { ReactNode } from "react";
import { formatoPesos } from "@/lib/numeros";

export type LineaLibro = { id: string; fecha: string; detalle: ReactNode; debe: number | null; haber: number | null };

const COLUMNAS = "sm:grid-cols-[9rem_minmax(0,1fr)_9rem_9rem_9rem]";
const redondear = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Cuenta corriente como libro de DEBE y HABER. Debe = lo que se le va cargando al cliente (pedido cargado, ajustes por lo entregado);
 * Haber = lo que va pagando. La diferencia entre las dos columnas es el saldo (lo que debe, si es positivo).
 */
export function LibroCuenta({ lineas, vacio }: { lineas: LineaLibro[]; vacio: string }) {
  const totalDebe = redondear(lineas.reduce((s, l) => s + (l.debe ?? 0), 0));
  const totalHaber = redondear(lineas.reduce((s, l) => s + (l.haber ?? 0), 0));
  const saldoFinal = redondear(totalDebe - totalHaber);
  let acumulado = 0;
  const conSaldo = lineas.map((l) => {
    acumulado = redondear(acumulado + (l.debe ?? 0) - (l.haber ?? 0));
    return { ...l, saldo: acumulado };
  });
  const plata = (n: number | null) => (n === null || n === 0 ? <span className="text-stone-400">—</span> : formatoPesos(n));

  if (lineas.length === 0) return <p className="rounded-xl border border-dashed border-stone-400 bg-white p-4 text-center text-sm text-stone-600">{vacio}</p>;

  return (
    <div className="overflow-hidden rounded-xl border border-stone-300 bg-white text-sm shadow-sm">
      <div className={`hidden gap-x-4 px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-stone-600 sm:grid ${COLUMNAS}`}>
        <span>Fecha</span><span>Detalle</span><span>Debe</span><span>Haber</span><span>Saldo</span>
      </div>
      {conSaldo.map((l) => (
        <div key={l.id} className={`grid grid-cols-3 items-center gap-x-4 gap-y-1 border-t border-stone-300 px-5 py-2 text-center ${COLUMNAS}`}>
          <span className="col-span-3 text-xs text-stone-500 sm:col-span-1">{l.fecha}</span>
          <div className="col-span-3 sm:col-span-1">{l.detalle}</div>
          <span className="tabular-nums"><span className="text-[10px] uppercase text-stone-500 sm:hidden">Debe </span>{plata(l.debe)}</span>
          <span className="tabular-nums"><span className="text-[10px] uppercase text-stone-500 sm:hidden">Haber </span>{plata(l.haber)}</span>
          <span className="font-semibold tabular-nums"><span className="text-[10px] font-normal uppercase text-stone-500 sm:hidden">Saldo </span>{formatoPesos(l.saldo)}</span>
        </div>
      ))}
      <div className={`grid grid-cols-3 items-center gap-x-4 gap-y-1 border-t-2 border-stone-500 bg-crema-100 px-5 py-2.5 text-center font-bold ${COLUMNAS}`}>
        <span className="col-span-3 text-left text-xs uppercase tracking-wide text-stone-700 sm:col-span-2 sm:text-center">Totales · saldo = debe − haber</span>
        <span className="tabular-nums">{formatoPesos(totalDebe)}</span>
        <span className="tabular-nums">{formatoPesos(totalHaber)}</span>
        <span className={`tabular-nums ${saldoFinal > 0 ? "text-rojo-700" : ""}`}>{formatoPesos(saldoFinal)}</span>
      </div>
    </div>
  );
}

/** Convierte un movimiento (monto + suma deuda, − la baja) en su línea de debe o haber. Los pagos van al haber; todo lo demás, al debe. */
export function columnasDeMovimiento(tipo: string, monto: number): { debe: number | null; haber: number | null } {
  if (tipo === "PAGO" || tipo === "ANULACION_PAGO") return { debe: null, haber: redondear(-monto) };
  return { debe: monto, haber: null };
}
