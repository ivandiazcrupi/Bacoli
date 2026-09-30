"use client";

import { useActionState } from "react";
import { Campo, Mensajes, estiloBoton, estiloCampo } from "@/components/campos";
import { guardarSucursal } from "./actions";

type Props = {
  clienteId: string;
  sucursal?: { id: string; alias: string; direccion: string; barrio: string; zonaId: string; telefono: string; comentario: string };
  zonas: { id: string; nombre: string }[];
  barrios: string[];
};

export function SucursalForm({ clienteId, sucursal, zonas, barrios }: Props) {
  const [estado, enviar, cargando] = useActionState(guardarSucursal.bind(null, clienteId, sucursal?.id ?? null), undefined);
  const v = (c: "alias" | "direccion" | "barrio" | "zonaId" | "telefono" | "comentario") => estado?.valores?.[c] ?? sucursal?.[c] ?? "";

  return (
    <form key={JSON.stringify(estado ?? null)} action={enviar} className="space-y-3">
      <Campo etiqueta="Nombre de la sucursal" ayuda="Opcional. Ej: Retiro.">
        <input name="alias" defaultValue={v("alias")} className={estiloCampo} />
      </Campo>
      <Campo etiqueta="Dirección *">
        <input name="direccion" defaultValue={v("direccion")} required className={estiloCampo} />
      </Campo>
      <Campo etiqueta="Barrio *">
        <input name="barrio" list="barrios-sucursal" defaultValue={v("barrio")} required className={estiloCampo} />
      </Campo>
      <datalist id="barrios-sucursal">{barrios.map((b) => <option key={b} value={b} />)}</datalist>
      <Campo etiqueta="Zona de reparto *">
        <select name="zonaId" defaultValue={v("zonaId")} required className={estiloCampo}>
          <option value="" disabled>Elegí la zona</option>
          {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
        </select>
      </Campo>
      <Campo etiqueta="Teléfono">
        <input name="telefono" inputMode="tel" defaultValue={v("telefono")} className={estiloCampo} />
      </Campo>
      <Campo etiqueta="Comentario" ayuda="Ej: horario de entrega.">
        <input name="comentario" defaultValue={v("comentario")} className={estiloCampo} />
      </Campo>
      <Mensajes estado={estado} />
      <button disabled={cargando} className={estiloBoton}>{cargando ? "Guardando…" : sucursal ? "Guardar sucursal" : "Agregar sucursal"}</button>
    </form>
  );
}
