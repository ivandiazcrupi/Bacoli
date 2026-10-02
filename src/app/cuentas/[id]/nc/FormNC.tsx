"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatoPesos } from "@/lib/numeros";
import { aplicarSaldoNota, crearNotaCredito } from "../../actions";

export type Comprobante = { id: string; tipo: "FACTURA" | "REMITO"; numero: string | null; fecha: string; debe: number };
export type NotaExistente = { id: string; numero: string | null; restante: number };

const aTexto = (n: number) => n.toFixed(2).replace(".", ",");
const aNumero = (s: string) => {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const fechaCorta = (s: string) => `${s.slice(8)}/${s.slice(5, 7)}/${s.slice(2, 4)}`;

// Nota de crédito: número, motivo, monto total y a qué comprobantes se aplica (uno o varios; lo que sobra queda a favor del cliente).
export function FormNC({ clienteId, comprobantes, inicial, nota }: { clienteId: string; comprobantes: Comprobante[]; inicial: string | null; nota: NotaExistente | null }) {
  const router = useRouter();
  const [numero, setNumero] = useState("");
  const [motivo, setMotivo] = useState("");
  const [monto, setMonto] = useState(nota ? aTexto(nota.restante) : "");
  const [elegidos, setElegidos] = useState<Set<string>>(new Set(inicial ? [inicial] : []));
  const [aplic, setAplic] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [trabajando, empezar] = useTransition();

  // Reparte el monto entre los elegidos, del más viejo al más nuevo, hasta lo que debe cada uno.
  const repartir = (total: number, ids: Set<string>) => {
    let resto = total;
    const salida: Record<string, string> = {};
    for (const c of comprobantes) {
      if (!ids.has(c.id)) continue;
      const parte = Math.max(0, Math.min(resto, c.debe));
      salida[c.id] = parte > 0 ? aTexto(parte) : "";
      resto -= parte;
    }
    setAplic(salida);
  };
  // Si llegó con un comprobante elegido de entrada y todavía no hay monto, propone cubrirlo entero.
  const [iniciado, setIniciado] = useState(false);
  if (!iniciado && inicial && !nota) {
    const c = comprobantes.find((x) => x.id === inicial);
    if (c) { setMonto(aTexto(c.debe)); setAplic({ [c.id]: aTexto(c.debe) }); }
    setIniciado(true);
  }

  const alternar = (id: string) => {
    const n = new Set(elegidos);
    if (n.has(id)) n.delete(id); else n.add(id);
    setElegidos(n);
    repartir(aNumero(monto), n);
  };
  const totalAplicado = comprobantes.reduce((t, c) => t + (elegidos.has(c.id) ? aNumero(aplic[c.id] ?? "") : 0), 0);
  const total = aNumero(monto);
  const sobra = Math.round((total - totalAplicado) * 100) / 100;

  const guardar = () => {
    setError(null);
    const aplicaciones = comprobantes.filter((c) => elegidos.has(c.id)).map((c) => ({ pedidoId: c.id, monto: aNumero(aplic[c.id] ?? "") })).filter((a) => a.monto > 0);
    empezar(async () => {
      const r = nota
        ? await aplicarSaldoNota(nota.id, aplicaciones)
        : await crearNotaCredito({ clienteId, numero, motivo, monto: total, aplicaciones });
      if (!r.ok) { setError(r.error ?? "No se pudo guardar."); return; }
      router.push(`/cuentas/${clienteId}`);
      router.refresh();
    });
  };

  const campo = "mt-1 h-10 w-full rounded-md border border-stone-400 bg-white px-3 text-sm shadow-sm focus:border-verde-700 focus:outline-none";
  return (
    <div className="space-y-4">
      {!nota && (
        <section className="grid gap-4 rounded-xl border border-stone-300 bg-white p-4 shadow-sm sm:grid-cols-3">
          <label className="text-sm font-semibold">N° de la nota de crédito
            <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="0001-00000045 (si es de ARCA)" className={`${campo} font-normal`} />
          </label>
          <label className="text-sm font-semibold">Motivo
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} list="motivos" placeholder="Devolución, error de precio…" className={`${campo} font-normal`} />
            <datalist id="motivos"><option value="Devolución de mercadería" /><option value="Error de precio" /><option value="Descuento" /><option value="Faltante" /><option value="Factura anulada" /></datalist>
          </label>
          <label className="text-sm font-semibold">Monto total de la nota ($)
            <input value={monto} onChange={(e) => { setMonto(e.target.value); repartir(aNumero(e.target.value), elegidos); }} inputMode="decimal" placeholder="0,00" className={`${campo} text-right font-normal tabular-nums`} />
          </label>
        </section>
      )}
      {nota && <p className="rounded-xl border border-stone-300 bg-white p-4 text-sm shadow-sm">Nota de crédito <b>{nota.numero ?? "s/n"}</b> · saldo a aplicar: <b>{formatoPesos(nota.restante)}</b></p>}

      <section className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm" aria-label="Comprobantes a los que se aplica">
        <p className="border-b border-stone-300 bg-crema-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-600">Aplicar a (tildá uno o varios)</p>
        {comprobantes.length === 0 ? (
          <p className="p-6 text-center text-stone-600">Este cliente no tiene comprobantes sin pagar. La nota quedará como saldo a favor.</p>
        ) : (
          <ul className="divide-y divide-stone-300">
            {comprobantes.map((c) => (
              <li key={c.id} className={`grid grid-cols-[28px_1fr_90px_130px_150px] items-center gap-x-3 px-4 py-2.5 text-center text-sm ${elegidos.has(c.id) ? "bg-crema-50" : ""}`}>
                <input type="checkbox" checked={elegidos.has(c.id)} onChange={() => alternar(c.id)} aria-label={`Elegir ${c.numero ?? "comprobante"}`} className="h-4 w-4 accent-[#026433]" />
                <span className="font-semibold">{c.tipo === "FACTURA" ? "Factura" : "Remito"} {c.numero ?? "sin número"}</span>
                <span className="tabular-nums">{fechaCorta(c.fecha)}</span>
                <span className="tabular-nums">debe {formatoPesos(c.debe)}</span>
                <input
                  value={elegidos.has(c.id) ? aplic[c.id] ?? "" : ""}
                  onChange={(e) => setAplic({ ...aplic, [c.id]: e.target.value })}
                  disabled={!elegidos.has(c.id)}
                  inputMode="decimal"
                  placeholder="Aplicar $"
                  aria-label="Monto a aplicar"
                  className="h-9 w-full rounded border border-stone-300 bg-white px-2 text-right tabular-nums disabled:bg-stone-100"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-300 bg-crema-100 px-4 py-3 text-sm">
        <p>
          Aplicado <b className="tabular-nums">{formatoPesos(totalAplicado)}</b> de <b className="tabular-nums">{formatoPesos(total)}</b>
          {sobra > 0.004 && <span className="ml-2 text-stone-700">· sobran <b className="tabular-nums">{formatoPesos(sobra)}</b> (quedan a favor del cliente)</span>}
          {sobra < -0.004 && <span className="ml-2 font-semibold text-rojo-700">· te pasaste por {formatoPesos(-sobra)}</span>}
        </p>
        <button type="button" onClick={guardar} disabled={trabajando || total <= 0 || sobra < -0.004} className="h-10 rounded-md bg-verde-700 px-6 text-sm font-semibold text-white hover:bg-verde-800 disabled:opacity-50">{trabajando ? "Guardando…" : nota ? "Aplicar saldo" : "Guardar nota de crédito"}</button>
      </div>
      {error && <p className="rounded-lg border border-rojo-600 bg-rojo-50 p-3 text-sm text-rojo-700" role="alert">{error}</p>}
    </div>
  );
}
