"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Mensajes, estiloBoton } from "@/components/campos";
import { buscarDestinos, type Destino, type EstadoPedidoForm } from "./actions";

const campo = "mt-1 h-10 w-full rounded-md border border-stone-400 bg-white px-3 text-base font-normal text-stone-900 shadow-sm focus:border-verde-700 focus:outline-none focus:ring-2 focus:ring-verde-700/25";
const etiqueta = "block text-xs font-semibold uppercase tracking-wide text-stone-600";

export type DatosCobranza = { nombre: string; barrio: string; direccion: string; telefono: string; monto: string; nota: string };

// Cobranza: una parada para cobrar plata en una dirección. Se puede completar a mano o buscando un cliente (solo copia sus datos: no se enlaza ni toca su cuenta corriente).
export function FormularioCobranza({ accion, inicial, textoBoton, limpiarAlGuardar }: { accion: (estado: EstadoPedidoForm, formData: FormData) => Promise<EstadoPedidoForm>; inicial?: DatosCobranza; textoBoton: string; limpiarAlGuardar?: boolean }) {
  const [estado, enviar, cargando] = useActionState(accion, undefined as EstadoPedidoForm);
  const form = useRef<HTMLFormElement>(null);
  const [datos, setDatos] = useState<DatosCobranza>(inicial ?? { nombre: "", barrio: "", direccion: "", telefono: "", monto: "", nota: "" });
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Destino[]>([]);
  const poner = (c: keyof DatosCobranza, v: string) => setDatos((d) => ({ ...d, [c]: v }));

  useEffect(() => {
    if (!q.trim()) { setResultados([]); return; }
    const espera = setTimeout(async () => setResultados(await buscarDestinos(q)), 250);
    return () => clearTimeout(espera);
  }, [q]);

  // Al guardar bien una cobranza nueva, el formulario queda limpio para cargar la siguiente.
  useEffect(() => {
    if (estado?.ok && limpiarAlGuardar) { setDatos({ nombre: "", barrio: "", direccion: "", telefono: "", monto: "", nota: "" }); setQ(""); setResultados([]); }
  }, [estado, limpiarAlGuardar]);

  const elegir = (d: Destino) => {
    setDatos((x) => ({ ...x, nombre: d.cliente, barrio: d.barrio, direccion: d.direccion, telefono: d.telefono }));
    setQ(""); setResultados([]);
  };

  return (
    <form ref={form} action={enviar} className="space-y-4">
      <section className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
        <label className={etiqueta}>
          ¿Es de un cliente que ya está cargado? Buscalo y se completan los datos (si no, escribilos abajo)
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escribí el cliente, la sucursal o el barrio" className={`${campo} normal-case tracking-normal`} />
        </label>
        {resultados.length > 0 && (
          <div className="mt-2 overflow-hidden rounded-lg border border-stone-300">
            {resultados.map((d) => (
              <button key={d.puntoId} type="button" onClick={() => elegir(d)} className="grid w-full grid-cols-[1fr_1.4fr_2fr] gap-3 border-t border-stone-300 px-4 py-2 text-left text-sm first:border-t-0 hover:bg-crema-100">
                <span className="font-semibold">{d.barrio}</span><span className="font-semibold">{d.cliente}</span><span>{d.direccion}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-600">Datos de la cobranza</p>
        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_2fr_1fr]">
          <label className={etiqueta}>A quién se le cobra<input name="nombre" required value={datos.nombre} onChange={(e) => poner("nombre", e.target.value)} className={`${campo} dato`} autoCapitalize="characters" /></label>
          <label className={etiqueta}>Barrio<input name="barrio" value={datos.barrio} onChange={(e) => poner("barrio", e.target.value)} className={`${campo} dato`} autoCapitalize="characters" /></label>
          <label className={etiqueta}>Dirección<input name="direccion" required value={datos.direccion} onChange={(e) => poner("direccion", e.target.value)} className={campo} /></label>
          <label className={etiqueta}>Teléfono<input name="telefono" inputMode="tel" value={datos.telefono} onChange={(e) => poner("telefono", e.target.value)} className={campo} /></label>
        </div>
      </section>

      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_20rem]">
        <label className="flex flex-col rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
          <span className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-600">Nota importante (se ve en rojo en la ruta)</span>
          <input name="nota" value={datos.nota} onChange={(e) => poner("nota", e.target.value)} placeholder="Ej.: Pedir por Marta, cobra de 8 a 10 hs" className="w-full rounded-md border border-stone-400 bg-white px-3 py-2.5 text-base" />
        </label>
        <div className="rounded-xl border border-stone-300 bg-white p-4 text-sm shadow-sm">
          <label className="block text-center text-xs font-semibold uppercase tracking-wide text-stone-600">
            Cuánto hay que cobrar ($)
            <input name="monto" required inputMode="decimal" value={datos.monto} onChange={(e) => poner("monto", e.target.value)} placeholder="0" className="mt-1 h-10 w-full rounded-md border border-stone-400 bg-white px-3 text-center text-lg font-bold tabular-nums text-stone-900" />
          </label>
          <button disabled={cargando} className={`${estiloBoton} mt-3`}>{cargando ? "Guardando…" : textoBoton}</button>
          <Mensajes estado={estado} />
        </div>
      </div>
      <p className="text-center text-xs text-stone-500">Una cobranza no lleva productos, no suma paquetes ni facturación y no pasa por la cuenta corriente.</p>
    </form>
  );
}
