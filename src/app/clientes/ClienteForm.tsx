"use client";

import { useActionState, useState } from "react";
import { Campo, Mensajes, estiloBoton, estiloCampo } from "@/components/campos";
import { CONDICION_PAGO, IMPUTACION_PAGO, TIPO_CLIENTE } from "@/lib/etiquetas";
import type { EstadoForm } from "./validacion";

export type DatosCliente = {
  nombre: string;
  tipo: string;
  razonSocial: string;
  cuit: string;
  facturado: boolean;
  condicionPago: string;
  listaPreciosId: string;
  descuentoPct: string;
  imputacionPago: string;
  sinLimite: boolean;
  maxPedidosImpagos: string;
  maxMonto: string;
  comisionista: string;
  comisionPct: string;
};

export const CLIENTE_VACIO: DatosCliente = {
  nombre: "", tipo: "", razonSocial: "", cuit: "", facturado: false, condicionPago: "CONTADO", listaPreciosId: "",
  descuentoPct: "", imputacionPago: "SALDO", sinLimite: false, maxPedidosImpagos: "", maxMonto: "", comisionista: "", comisionPct: "",
};

type Props = {
  accion: (estado: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  inicial: DatosCliente;
  listas: { id: string; nombre: string }[];
  zonas?: { id: string; nombre: string }[]; // solo al crear: pide la primera sucursal
  barrios?: string[];
  textoBoton: string;
};

export function ClienteForm({ accion, inicial, listas, zonas, barrios = [], textoBoton }: Props) {
  const [estado, enviar, cargando] = useActionState(accion, undefined);
  const v = (campo: keyof DatosCliente) => estado?.valores?.[campo] ?? (inicial[campo] as string);
  const [sinLimite, setSinLimite] = useState(inicial.sinLimite);
  const [facturado, setFacturado] = useState(inicial.facturado);

  return (
    <form key={JSON.stringify(estado ?? null)} action={enviar} className="space-y-4 rounded-lg border border-stone-200 bg-white p-4">
      <Campo etiqueta="Nombre *">
        <input name="nombre" defaultValue={v("nombre")} required className={estiloCampo} />
      </Campo>
      <Campo etiqueta="Tipo de cliente *">
        <select name="tipo" defaultValue={v("tipo")} required className={estiloCampo}>
          <option value="" disabled>Elegí el tipo</option>
          {Object.entries(TIPO_CLIENTE).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
      </Campo>
      <Campo etiqueta="Razón social" ayuda="Opcional.">
        <input name="razonSocial" defaultValue={v("razonSocial")} className={estiloCampo} />
      </Campo>
      <Campo etiqueta="CUIT" ayuda="Opcional. Obligatorio si lleva factura.">
        <input name="cuit" inputMode="numeric" defaultValue={v("cuit")} className={estiloCampo} />
      </Campo>
      <label className="flex items-center gap-3 text-sm font-medium">
        <input type="checkbox" name="facturado" checked={facturado} onChange={(e) => setFacturado(e.target.checked)} className="h-5 w-5" />
        Lleva factura (se suma IVA 10,5%). Si no, va con remito.
      </label>

      <h2 className="pt-2 font-semibold">Precios y pago</h2>
      <Campo etiqueta="Lista de precios">
        <select name="listaPreciosId" defaultValue={v("listaPreciosId")} className={estiloCampo}>
          <option value="">Sin asignar</option>
          {listas.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
        </select>
      </Campo>
      <Campo etiqueta="Descuento especial (%)" ayuda="Se aplica sobre la lista. Dejar vacío si no tiene.">
        <input name="descuentoPct" inputMode="decimal" defaultValue={v("descuentoPct")} className={estiloCampo} />
      </Campo>
      <Campo etiqueta="Condición de pago">
        <select name="condicionPago" defaultValue={v("condicionPago")} className={estiloCampo}>
          {Object.entries(CONDICION_PAGO).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
      </Campo>
      <Campo etiqueta="Los pagos se aplican">
        <select name="imputacionPago" defaultValue={v("imputacionPago")} className={estiloCampo}>
          {Object.entries(IMPUTACION_PAGO).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
      </Campo>

      <h2 className="pt-2 font-semibold">Límites de deuda</h2>
      <label className="flex items-center gap-3 text-sm font-medium">
        <input type="checkbox" name="sinLimite" checked={sinLimite} onChange={(e) => setSinLimite(e.target.checked)} className="h-5 w-5" />
        Cuenta sin límite (nunca se frena un pedido)
      </label>
      {!sinLimite && (
        <>
          <Campo etiqueta="Máximo de pedidos sin pagar" ayuda="Ej: 2 = no puede pedir el tercero sin haber pagado los dos anteriores. Vacío = sin tope.">
            <input name="maxPedidosImpagos" inputMode="numeric" defaultValue={v("maxPedidosImpagos")} className={estiloCampo} />
          </Campo>
          <Campo etiqueta="Deuda máxima ($)" ayuda="Vacío = sin tope.">
            <input name="maxMonto" inputMode="decimal" defaultValue={v("maxMonto")} className={estiloCampo} />
          </Campo>
        </>
      )}

      <h2 className="pt-2 font-semibold">Comisión</h2>
      <Campo etiqueta="Comisionista" ayuda="Ej: Migue. Vacío si no corresponde.">
        <input name="comisionista" defaultValue={v("comisionista")} className={estiloCampo} />
      </Campo>
      <Campo etiqueta="Comisión (%)">
        <input name="comisionPct" inputMode="decimal" defaultValue={v("comisionPct")} className={estiloCampo} />
      </Campo>

      {zonas && (
        <>
          <h2 className="pt-2 font-semibold">Primera sucursal</h2>
          <Campo etiqueta="Nombre de la sucursal" ayuda="Opcional. Ej: Retiro.">
            <input name="alias" defaultValue={estado?.valores?.alias ?? ""} className={estiloCampo} />
          </Campo>
          <Campo etiqueta="Dirección *">
            <input name="direccion" defaultValue={estado?.valores?.direccion ?? ""} required className={estiloCampo} />
          </Campo>
          <Campo etiqueta="Barrio *">
            <input name="barrio" list="barrios" defaultValue={estado?.valores?.barrio ?? ""} required className={estiloCampo} />
          </Campo>
          <datalist id="barrios">{barrios.map((b) => <option key={b} value={b} />)}</datalist>
          <Campo etiqueta="Zona de reparto *">
            <select name="zonaId" defaultValue={estado?.valores?.zonaId ?? ""} required className={estiloCampo}>
              <option value="" disabled>Elegí la zona</option>
              {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Teléfono">
            <input name="telefono" inputMode="tel" defaultValue={estado?.valores?.telefono ?? ""} className={estiloCampo} />
          </Campo>
        </>
      )}

      <Mensajes estado={estado} />
      <button disabled={cargando} className={estiloBoton}>{cargando ? "Guardando…" : textoBoton}</button>
    </form>
  );
}
