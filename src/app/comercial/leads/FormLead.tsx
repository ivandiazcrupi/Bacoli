"use client";

import { useActionState } from "react";
import { estiloCampo, estiloDato } from "@/components/campos";
import { ORIGENES, TIPOS_COMERCIO } from "@/lib/leads";
import type { EstadoLeadForm } from "./actions";

export type DatosLead = {
  nombre: string; telefono: string; barrio: string; tipoComercio: string; notas: string;
  contacto: string; email: string; direccion: string; origen: string; interes: string; vendedor: string; proximoContacto: string;
};
export const LEAD_VACIO: DatosLead = { nombre: "", telefono: "", barrio: "", tipoComercio: "", notas: "", contacto: "", email: "", direccion: "", origen: "", interes: "", vendedor: "", proximoContacto: "" };

const etiqueta = "block text-[12px] font-semibold uppercase tracking-wide text-stone-500";

// Formulario del lead, en horizontal como el de un cliente: arriba lo importante (nombre, teléfono, barrio, tipo de comercio y nota)
// y, plegado, "Más datos" (opcional). Lo usan "Cargar con más datos" y la ficha del lead.
export function FormLead({ accion, inicial, textoBoton, vendedores }: {
  accion: (e: EstadoLeadForm, f: FormData) => Promise<EstadoLeadForm>; inicial: DatosLead; textoBoton: string; vendedores: string[];
}) {
  const [estado, enviar, cargando] = useActionState(accion, undefined);
  const v = (k: keyof DatosLead) => estado?.valores?.[k] ?? inicial[k];
  const hayMas = (["contacto", "email", "direccion", "origen", "interes", "vendedor", "proximoContacto"] as const).some((k) => v(k));
  return (
    <form key={JSON.stringify(estado ?? null)} action={enviar} className="space-y-3">
      <section className="rounded-lg border border-stone-300 bg-white p-4">
        <div className="grid items-start gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_1.6fr]">
          <label className={etiqueta}>Nombre *
            <input name="nombre" autoCapitalize="characters" autoComplete="off" defaultValue={v("nombre")} required className={`${estiloDato} mt-1`} />
          </label>
          <label className={etiqueta}>Teléfono
            <input name="telefono" inputMode="tel" autoComplete="off" defaultValue={v("telefono")} className={`${estiloCampo} mt-1`} />
          </label>
          <label className={etiqueta}>Barrio
            <input name="barrio" autoCapitalize="characters" autoComplete="off" defaultValue={v("barrio")} className={`${estiloDato} mt-1`} />
          </label>
          <label className={etiqueta}>Tipo de comercio
            <input name="tipoComercio" list="tipos-comercio-form" autoCapitalize="characters" autoComplete="off" defaultValue={v("tipoComercio")} placeholder="Almacén, pizzería…" className={`${estiloDato} mt-1`} />
            <datalist id="tipos-comercio-form">{TIPOS_COMERCIO.map((t) => <option key={t} value={t} />)}</datalist>
          </label>
          <label className={etiqueta}>Nota
            <textarea name="notas" rows={1} defaultValue={v("notas")} className={`${estiloCampo} mt-1`} />
          </label>
        </div>
      </section>

      <details open={hayMas} className="rounded-lg border border-stone-300 bg-white">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold text-stone-600">Más datos <span className="font-normal text-stone-400">(opcional)</span></summary>
        <div className="grid gap-3 border-t border-stone-200 p-4 md:grid-cols-4">
          <label className={etiqueta}>Con quién se habla
            <input name="contacto" autoComplete="off" defaultValue={v("contacto")} className={`${estiloCampo} mt-1`} />
          </label>
          <label className={etiqueta}>Email
            <input name="email" type="email" defaultValue={v("email")} className={`${estiloCampo} mt-1`} />
          </label>
          <label className={etiqueta}>Dirección
            <input name="direccion" autoComplete="off" defaultValue={v("direccion")} className={`${estiloCampo} mt-1`} />
          </label>
          <label className={etiqueta}>Cómo llegó
            <select name="origen" defaultValue={v("origen")} className={`${estiloCampo} mt-1`}><option value="">—</option>{ORIGENES.map((o) => <option key={o}>{o}</option>)}</select>
          </label>
          <label className={etiqueta}>Vendedor
            <input name="vendedor" list="vendedores-leads" autoComplete="off" defaultValue={v("vendedor")} className={`${estiloCampo} mt-1`} />
            <datalist id="vendedores-leads">{vendedores.map((x) => <option key={x} value={x} />)}</datalist>
          </label>
          <label className={etiqueta}>Escribirle el
            <input name="proximoContacto" type="date" defaultValue={v("proximoContacto")} className={`${estiloCampo} mt-1`} />
          </label>
          <label className={`${etiqueta} md:col-span-2`}>Qué le interesa / cuánto podría pedir
            <input name="interes" autoComplete="off" defaultValue={v("interes")} className={`${estiloCampo} mt-1`} />
          </label>
        </div>
      </details>

      {estado?.error && <p className="rounded-md bg-rojo-50 px-3 py-2 text-sm font-medium text-rojo-700">{estado.error}</p>}
      {estado?.valores?.ok && <p className="rounded-md bg-verde-50 px-3 py-2 text-sm font-medium text-verde-800">Guardado.</p>}
      <button disabled={cargando} className="rounded-lg bg-verde-700 px-6 py-2.5 font-semibold text-white hover:bg-verde-800 disabled:opacity-60">{cargando ? "Guardando…" : textoBoton}</button>
    </form>
  );
}
