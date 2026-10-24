"use client";

import { useActionState } from "react";
import { Bloque, Campo, Mensajes, estiloCampo, estiloDato } from "@/components/campos";
import { guardarEmpresa, type EstadoEmpresa } from "./actions";

type Datos = Record<"razonSocial" | "nombreComercial" | "cuit" | "condicionIva" | "domicilio" | "telefono" | "email" | "ingresosBrutos" | "inicioActividades" | "puntoVenta" | "avisoHorario" | "avisoTexto", string>;

export function FormularioEmpresa({ inicial, proximoRemito }: { inicial: Datos; proximoRemito: number }) {
  const [estado, enviar, cargando] = useActionState(guardarEmpresa, undefined as EstadoEmpresa);
  const v = (c: keyof Datos) => estado?.valores?.[c] ?? inicial[c];
  return (
    <form key={JSON.stringify(estado ?? null)} action={enviar} className="space-y-3">
      <Bloque titulo="La empresa" ayuda="Nombre y CUIT, como figuran en los remitos y en las facturas.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1.3fr]">
          <Campo etiqueta="Razón social *"><input name="razonSocial" autoCapitalize="characters" defaultValue={v("razonSocial")} required className={estiloDato} /></Campo>
          <Campo etiqueta="Nombre comercial"><input name="nombreComercial" autoCapitalize="characters" defaultValue={v("nombreComercial")} className={estiloDato} /></Campo>
          <Campo etiqueta="CUIT"><input name="cuit" inputMode="numeric" defaultValue={v("cuit")} className={estiloCampo} /></Campo>
        </div>
      </Bloque>

      <Bloque titulo="Contacto" ayuda="Dónde está y cómo comunicarse.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Domicilio"><input name="domicilio" defaultValue={v("domicilio")} className={estiloCampo} /></Campo>
          <Campo etiqueta="Teléfono"><input name="telefono" inputMode="tel" defaultValue={v("telefono")} className={estiloCampo} /></Campo>
          <Campo etiqueta="Email"><input name="email" type="email" defaultValue={v("email")} className={estiloCampo} /></Campo>
        </div>
      </Bloque>

      <Bloque titulo="Impuestos" ayuda="Para la factura electrónica.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta="Condición frente al IVA"><input name="condicionIva" defaultValue={v("condicionIva")} placeholder="Ej: Responsable Inscripto" className={estiloCampo} /></Campo>
          <Campo etiqueta="Ingresos Brutos"><input name="ingresosBrutos" defaultValue={v("ingresosBrutos")} className={estiloCampo} /></Campo>
          <Campo etiqueta="Inicio de actividades"><input name="inicioActividades" defaultValue={v("inicioActividades")} placeholder="dd/mm/aaaa" className={estiloCampo} /></Campo>
          <Campo etiqueta="Punto de venta"><input name="puntoVenta" inputMode="numeric" defaultValue={v("puntoVenta")} className={estiloCampo} /></Campo>
        </div>
      </Bloque>

      <Bloque titulo="Aviso por email" ayuda="Mail a los clientes de la tienda con el día en que reciben su pedido (botón “Avisar por email” en la hoja de ruta de cada día).">
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <Campo etiqueta="Horario (fijo)" ayuda="Se escribe como va a salir en el mail.">
            <input name="avisoHorario" defaultValue={v("avisoHorario")} placeholder="entre las 14 y las 18 hs" className={estiloCampo} />
          </Campo>
          <Campo etiqueta="Texto del mail" ayuda="Podés usar {nombre}, {orden}, {dia} y {horario}. Vacío = el texto de siempre.">
            <textarea name="avisoTexto" rows={4} defaultValue={v("avisoTexto")} placeholder="Hola {nombre}, ¡gracias por tu compra en BACOLI! Tu pedido #{orden} llega el {dia}, {horario}." className={estiloCampo + " h-auto py-2"} />
          </Campo>
        </div>
      </Bloque>

      <Bloque titulo="Remitos" ayuda="La numeración correlativa (R-000001…).">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Próximo número de remito" ayuda="Se asigna solo. Cambialo únicamente para seguir otra numeración: nunca puede bajar.">
            <input name="proximoRemito" inputMode="numeric" defaultValue={estado?.valores?.proximoRemito ?? proximoRemito} className={estiloCampo} />
          </Campo>
        </div>
      </Bloque>

      <Mensajes estado={estado} />
      <div className="flex justify-end">
        <button disabled={cargando} className="w-full rounded-lg bg-verde-700 px-10 py-3 font-semibold text-white hover:bg-verde-800 disabled:opacity-60 sm:w-auto">{cargando ? "Guardando…" : "Guardar datos"}</button>
      </div>
    </form>
  );
}
