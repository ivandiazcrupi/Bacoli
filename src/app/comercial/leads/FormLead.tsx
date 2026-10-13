"use client";

import { useActionState } from "react";
import { Campo, estiloCampo, estiloDato } from "@/components/campos";
import { ORIGENES } from "@/lib/leads";
import type { EstadoLeadForm } from "./actions";

export type DatosLead = {
  nombre: string; contacto: string; telefono: string; email: string; barrio: string; direccion: string;
  origen: string; interes: string; notas: string; vendedor: string; proximoContacto: string;
};
export const LEAD_VACIO: DatosLead = { nombre: "", contacto: "", telefono: "", email: "", barrio: "", direccion: "", origen: "", interes: "", notas: "", vendedor: "", proximoContacto: "" };

export function FormLead({ accion, inicial, textoBoton, vendedores }: {
  accion: (e: EstadoLeadForm, f: FormData) => Promise<EstadoLeadForm>; inicial: DatosLead; textoBoton: string; vendedores: string[];
}) {
  const [estado, enviar, cargando] = useActionState(accion, undefined);
  const v = (k: keyof DatosLead) => estado?.valores?.[k] ?? inicial[k];
  return (
    <form key={JSON.stringify(estado ?? null)} action={enviar} className="space-y-4 rounded-lg border border-stone-300 bg-white p-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Campo etiqueta="Comercio o persona *"><input name="nombre" autoCapitalize="characters" defaultValue={v("nombre")} required className={estiloDato} /></Campo>
        <Campo etiqueta="Con quién se habla"><input name="contacto" defaultValue={v("contacto")} className={estiloCampo} /></Campo>
        <Campo etiqueta="Cómo llegó">
          <select name="origen" defaultValue={v("origen")} className={estiloCampo}><option value="">—</option>{ORIGENES.map((o) => <option key={o}>{o}</option>)}</select>
        </Campo>
        <Campo etiqueta="Teléfono / WhatsApp"><input name="telefono" inputMode="tel" defaultValue={v("telefono")} className={estiloCampo} /></Campo>
        <Campo etiqueta="Email"><input name="email" type="email" defaultValue={v("email")} className={estiloCampo} /></Campo>
        <Campo etiqueta="Vendedor (quién lo atiende)">
          <input name="vendedor" list="vendedores-leads" defaultValue={v("vendedor")} className={estiloCampo} />
          <datalist id="vendedores-leads">{vendedores.map((x) => <option key={x} value={x} />)}</datalist>
        </Campo>
        <Campo etiqueta="Barrio"><input name="barrio" autoCapitalize="characters" defaultValue={v("barrio")} className={estiloDato} /></Campo>
        <Campo etiqueta="Dirección"><input name="direccion" defaultValue={v("direccion")} className={estiloCampo} /></Campo>
        <Campo etiqueta="Próximo contacto"><input name="proximoContacto" type="date" defaultValue={v("proximoContacto")} className={estiloCampo} /></Campo>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Campo etiqueta="Qué le interesa / cuánto podría pedir"><textarea name="interes" rows={3} defaultValue={v("interes")} className={estiloCampo} /></Campo>
        <Campo etiqueta="Notas"><textarea name="notas" rows={3} defaultValue={v("notas")} className={estiloCampo} /></Campo>
      </div>
      {estado?.error && <p className="rounded-md bg-rojo-50 px-3 py-2 text-sm font-medium text-rojo-700">{estado.error}</p>}
      {estado?.valores?.ok && <p className="rounded-md bg-verde-50 px-3 py-2 text-sm font-medium text-verde-800">Guardado.</p>}
      <button disabled={cargando} className="rounded-lg bg-verde-700 px-6 py-2.5 font-semibold text-white hover:bg-verde-800 disabled:opacity-60">{cargando ? "Guardando…" : textoBoton}</button>
    </form>
  );
}
