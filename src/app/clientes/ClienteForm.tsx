"use client";

import { useActionState, useState } from "react";
import { Campo, Mensajes, estiloBoton, estiloCampo, estiloDato } from "@/components/campos";
import { CONDICION_PAGO } from "@/lib/etiquetas";
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
  const [facturado, setFacturado] = useState(inicial.facturado);

  return (
    <form key={JSON.stringify(estado ?? null)} action={enviar} className="space-y-4 rounded-lg border border-stone-200 bg-white p-4">
      <Campo etiqueta="Nombre *">
        <input name="nombre" autoCapitalize="characters" defaultValue={v("nombre")} required className={estiloDato} />
      </Campo>
      {/* Todos los clientes son mayoristas: los minoristas salen de la tienda online y no se cargan acá. */}
      <input type="hidden" name="tipo" value={inicial.tipo || "MAYORISTA"} />
      <Campo etiqueta="Razón social" ayuda="Opcional.">
        <input name="razonSocial" autoCapitalize="characters" defaultValue={v("razonSocial")} className={estiloDato} />
      </Campo>
      <Campo etiqueta="CUIT" ayuda="Opcional. Obligatorio si lleva factura.">
        <input name="cuit" inputMode="numeric" defaultValue={v("cuit")} className={estiloCampo} />
      </Campo>
      <label className="block text-sm font-medium">
        <span className="flex items-center gap-3">
          <input type="checkbox" name="facturado" checked={facturado} onChange={(e) => setFacturado(e.target.checked)} className="h-5 w-5" />
          Se le factura normalmente
        </span>
        <span className="mt-1 block pl-8 text-xs font-normal text-stone-500">
          Solo adelanta una elección: al cargarle un pedido ya viene marcado “con factura” (se suma IVA 10,5%) en vez de “con remito”. En cada pedido se puede cambiar.
        </span>
      </label>

      <h2 className="pt-2 font-semibold">Precios y pago</h2>
      <Campo etiqueta="Lista de precios" ayuda="Define el precio de cada producto. Las franquicias de VACALIN usan la lista VACALIN.">
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
      {/* Cómo se aplican los pagos (contra el saldo o contra cada pedido) todavía no se usa: se mantiene el valor y vuelve en Cuenta corriente. */}
      <input type="hidden" name="imputacionPago" value={inicial.imputacionPago} />

      <h2 className="pt-2 font-semibold">Límites de deuda</h2>
      <p className="-mt-2 text-xs text-stone-500">Si no completás nada, el cliente no tiene límite. Al pasarse se avisa y solo un dueño puede autorizar el pedido.</p>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Deuda máxima ($)">
          <input name="maxMonto" inputMode="decimal" placeholder="Sin límite" defaultValue={v("maxMonto")} className={estiloCampo} />
        </Campo>
        <Campo etiqueta="Pedidos sin pagar (máx.)">
          <input name="maxPedidosImpagos" inputMode="numeric" placeholder="Sin límite" defaultValue={v("maxPedidosImpagos")} className={estiloCampo} />
        </Campo>
      </div>

      <h2 className="pt-2 font-semibold">Comisión</h2>
      <p className="-mt-2 text-xs text-stone-500">Solo si la venta a este cliente le deja una comisión a alguien (ej.: Migue 8%). Por ahora queda anotado; más adelante servirá para calcular cuánto se le debe.</p>
      <div className="grid grid-cols-[2fr_1fr] gap-3">
        <Campo etiqueta="Comisionista">
          <input name="comisionista" autoCapitalize="characters" placeholder="Ej: MIGUE" defaultValue={v("comisionista")} className={estiloDato} />
        </Campo>
        <Campo etiqueta="Comisión (%)">
          <input name="comisionPct" inputMode="decimal" placeholder="Ej: 8" defaultValue={v("comisionPct")} className={estiloCampo} />
        </Campo>
      </div>

      {zonas && (
        <>
          <h2 className="pt-2 font-semibold">Primera sucursal</h2>
          <Campo etiqueta="Nombre de la sucursal" ayuda="Opcional. Ej: Retiro.">
            <input name="alias" autoCapitalize="characters" defaultValue={estado?.valores?.alias ?? ""} className={estiloDato} />
          </Campo>
          <Campo etiqueta="Dirección *">
            <input name="direccion" autoCapitalize="characters" defaultValue={estado?.valores?.direccion ?? ""} required className={estiloDato} />
          </Campo>
          <Campo etiqueta="Barrio *">
            <input name="barrio" autoCapitalize="characters" list="barrios" defaultValue={estado?.valores?.barrio ?? ""} required className={estiloDato} />
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
