"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cargarFactura } from "../actions";

type Cliente = { id: string; nombre: string };
const aNumero = (s: string) => {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// Cargar un comprobante directo: una factura nueva (por ejemplo, para reemplazar una que salió mal) o una nota de crédito.
export function FormCargar({ clientes, hoy }: { clientes: Cliente[]; hoy: string }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"FACTURA" | "NC">("FACTURA");
  const [cliente, setCliente] = useState("");
  const [numero, setNumero] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [total, setTotal] = useState("");
  const [obs, setObs] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [trabajando, empezar] = useTransition();

  const elegido = clientes.find((c) => c.nombre.toLowerCase() === cliente.trim().toLowerCase());
  const campo = "mt-1 h-10 w-full rounded-md border border-stone-400 bg-white px-3 text-sm font-normal shadow-sm focus:border-verde-700 focus:outline-none";

  const seguir = () => {
    setError(null);
    if (!elegido) return setError("Elegí un cliente de la lista.");
    if (tipo === "NC") return router.push(`/cuentas/${elegido.id}/nc`);
    empezar(async () => {
      const r = await cargarFactura({ clienteId: elegido.id, numero, fecha, total: aNumero(total), observacion: obs });
      if (!r.ok) return setError(r.error ?? "No se pudo cargar.");
      router.push(`/cuentas/${elegido.id}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Tipo de comprobante" className="inline-flex overflow-hidden rounded-md border border-stone-400 bg-white text-sm font-semibold shadow-sm">
        {([["FACTURA", "Factura"], ["NC", "Nota de crédito"]] as const).map(([v, t]) => (
          <button key={v} type="button" onClick={() => setTipo(v)} aria-pressed={tipo === v} className={`px-5 py-2.5 ${tipo === v ? "bg-stone-800 text-white" : "text-stone-700 hover:bg-crema-100"}`}>{t}</button>
        ))}
      </div>

      <section className="grid gap-4 rounded-xl border border-stone-300 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-semibold sm:col-span-2 lg:col-span-4">Cliente
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} list="clientes-cargar" placeholder="Escribí para buscar…" className={campo} />
          <datalist id="clientes-cargar">{clientes.map((c) => <option key={c.id} value={c.nombre} />)}</datalist>
        </label>
        {tipo === "FACTURA" ? (
          <>
            <label className="text-sm font-semibold">N° de factura
              <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="0001-00001234" className={campo} />
            </label>
            <label className="text-sm font-semibold">Fecha
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={campo} />
            </label>
            <label className="text-sm font-semibold">Total con IVA ($)
              <input value={total} onChange={(e) => setTotal(e.target.value)} inputMode="decimal" placeholder="0,00" className={`${campo} text-right tabular-nums`} />
            </label>
            <label className="text-sm font-semibold">Observación
              <input value={obs} onChange={(e) => setObs(e.target.value)} maxLength={200} placeholder="Reemplaza a la 0001-00001230…" className={campo} />
            </label>
          </>
        ) : (
          <p className="text-sm text-stone-600 sm:col-span-2 lg:col-span-4">Elegí el cliente y seguí: vas a cargar el N°, el motivo, el monto y a qué facturas se aplica.</p>
        )}
      </section>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-stone-600">{tipo === "FACTURA" ? "La factura queda entregada y a cobrar, y aparece en CUENTA → Facturas." : ""}</p>
        <button type="button" onClick={seguir} disabled={trabajando} className="h-10 rounded-md bg-verde-700 px-6 text-sm font-semibold text-white hover:bg-verde-800 disabled:opacity-50">{trabajando ? "Guardando…" : tipo === "FACTURA" ? "Cargar factura" : "Seguir"}</button>
      </div>
      {error && <p className="rounded-lg border border-rojo-600 bg-rojo-50 p-3 text-sm text-rojo-700" role="alert">{error}</p>}
    </div>
  );
}
