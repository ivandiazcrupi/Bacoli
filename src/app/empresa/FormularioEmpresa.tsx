"use client";

import { useActionState } from "react";
import { Campo, Mensajes, estiloBoton, estiloCampo, estiloDato } from "@/components/campos";
import { guardarEmpresa, type EstadoEmpresa } from "./actions";

type Datos = Record<"razonSocial" | "nombreComercial" | "cuit" | "condicionIva" | "domicilio" | "telefono" | "email" | "ingresosBrutos" | "inicioActividades" | "puntoVenta", string>;

export function FormularioEmpresa({ inicial, proximoRemito }: { inicial: Datos; proximoRemito: number }) {
  const [estado, enviar, cargando] = useActionState(guardarEmpresa, undefined as EstadoEmpresa);
  const v = (c: keyof Datos) => estado?.valores?.[c] ?? inicial[c];
  return (
    <form key={JSON.stringify(estado ?? null)} action={enviar} className="space-y-4 rounded-lg border border-stone-200 bg-white p-4">
      <Campo etiqueta="Razón social *"><input name="razonSocial" autoCapitalize="characters" defaultValue={v("razonSocial")} required className={estiloDato} /></Campo>
      <Campo etiqueta="Nombre comercial"><input name="nombreComercial" autoCapitalize="characters" defaultValue={v("nombreComercial")} className={estiloDato} /></Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="CUIT"><input name="cuit" inputMode="numeric" defaultValue={v("cuit")} className={estiloCampo} /></Campo>
        <Campo etiqueta="Condición frente al IVA"><input name="condicionIva" defaultValue={v("condicionIva")} placeholder="Ej: Responsable Inscripto" className={estiloCampo} /></Campo>
      </div>
      <Campo etiqueta="Domicilio"><input name="domicilio" defaultValue={v("domicilio")} className={estiloCampo} /></Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Teléfono"><input name="telefono" inputMode="tel" defaultValue={v("telefono")} className={estiloCampo} /></Campo>
        <Campo etiqueta="Email"><input name="email" type="email" defaultValue={v("email")} className={estiloCampo} /></Campo>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo etiqueta="Ingresos Brutos"><input name="ingresosBrutos" defaultValue={v("ingresosBrutos")} className={estiloCampo} /></Campo>
        <Campo etiqueta="Inicio de actividades"><input name="inicioActividades" defaultValue={v("inicioActividades")} placeholder="dd/mm/aaaa" className={estiloCampo} /></Campo>
        <Campo etiqueta="Punto de venta" ayuda="Para la factura electrónica."><input name="puntoVenta" inputMode="numeric" defaultValue={v("puntoVenta")} className={estiloCampo} /></Campo>
      </div>
      <Campo etiqueta="Próximo número de remito" ayuda="Se asigna solo. Cambialo únicamente si querés seguir la numeración de otro sistema o de talonarios: nunca puede bajar.">
        <input name="proximoRemito" inputMode="numeric" defaultValue={estado?.valores?.proximoRemito ?? proximoRemito} className={estiloCampo} />
      </Campo>
      <Mensajes estado={estado} />
      <button disabled={cargando} className={estiloBoton}>{cargando ? "Guardando…" : "Guardar datos"}</button>
    </form>
  );
}
