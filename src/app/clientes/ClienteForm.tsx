"use client";

import { useActionState, useState } from "react";
import { Bloque, Campo, Mensajes, estiloCampo, estiloDato } from "@/components/campos";
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
  observacion: string;
};

export const CLIENTE_VACIO: DatosCliente = {
  nombre: "", tipo: "", razonSocial: "", cuit: "", facturado: false, condicionPago: "CONTADO", listaPreciosId: "",
  descuentoPct: "", imputacionPago: "SALDO", sinLimite: false, maxPedidosImpagos: "", maxMonto: "", comisionista: "", comisionPct: "", observacion: "",
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

  // Cada bloque es una tarjeta horizontal: a la izquierda qué es, a la derecha sus campos en una sola fila.
  return (
    <form key={JSON.stringify(estado ?? null)} action={enviar} className="space-y-3">
      {/* Todos los clientes son mayoristas: los minoristas salen de la tienda online y no se cargan acá. */}
      <input type="hidden" name="tipo" value={inicial.tipo || "MAYORISTA"} />
      {/* Cómo se aplican los pagos (contra el saldo o contra cada pedido) todavía no se usa: se mantiene el valor y vuelve en Cuenta corriente. */}
      <input type="hidden" name="imputacionPago" value={inicial.imputacionPago} />

      <Bloque titulo="Datos del cliente" ayuda="Quién es y si se le factura.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_2fr_1.3fr_auto]">
          <Campo etiqueta="Nombre *">
            <input name="nombre" autoCapitalize="characters" defaultValue={v("nombre")} required className={estiloDato} />
          </Campo>
          <Campo etiqueta="Razón social">
            <input name="razonSocial" autoCapitalize="characters" placeholder="Opcional" defaultValue={v("razonSocial")} className={estiloDato} />
          </Campo>
          <Campo etiqueta="CUIT">
            <input name="cuit" inputMode="numeric" placeholder="Opcional" defaultValue={v("cuit")} className={estiloCampo} />
          </Campo>
          <label className="flex items-center gap-2 self-end pb-3 text-sm font-medium" title="Al cargarle un pedido ya viene marcado “con factura” (se suma IVA 10,5%) en vez de “con remito”. En cada pedido se puede cambiar. Si se le factura, el CUIT es obligatorio.">
            <input type="checkbox" name="facturado" checked={facturado} onChange={(e) => setFacturado(e.target.checked)} className="h-5 w-5" />
            Se le factura normalmente
          </label>
        </div>
      </Bloque>

      <Bloque titulo="Observación" ayuda="Algo importante para saber: por qué está desactivado, cuidados, acuerdos. Se ve arriba, en la ficha y en su cuenta.">
        <Campo etiqueta="Observación importante">
          <textarea name="observacion" rows={2} maxLength={500} placeholder="Ej: Desactivado por deuda desde marzo. Pedir pago adelantado." defaultValue={v("observacion")} className={estiloCampo} />
        </Campo>
      </Bloque>

      <Bloque titulo="Pago" ayuda="Cuándo paga. El precio se escribe en cada pedido.">
        <div className="grid gap-3 sm:grid-cols-1">
          {/* Las listas de precios no se usan por ahora; se conserva lo que el cliente ya tenía. */}
          <input type="hidden" name="listaPreciosId" value={v("listaPreciosId")} />
          <input type="hidden" name="descuentoPct" value={v("descuentoPct")} />
          <Campo etiqueta="Condición de pago">
            <select name="condicionPago" defaultValue={v("condicionPago")} className={estiloCampo}>
              {Object.entries(CONDICION_PAGO).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </Campo>
        </div>
      </Bloque>

      <Bloque titulo="Límites de deuda" ayuda="Si no completás nada, no tiene límite. Al pasarse se avisa y solo un dueño autoriza.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Deuda máxima ($)">
            <input name="maxMonto" inputMode="decimal" placeholder="Sin límite" defaultValue={v("maxMonto")} className={estiloCampo} />
          </Campo>
          <Campo etiqueta="Pedidos sin pagar (máx.)">
            <input name="maxPedidosImpagos" inputMode="numeric" placeholder="Sin límite" defaultValue={v("maxPedidosImpagos")} className={estiloCampo} />
          </Campo>
        </div>
      </Bloque>

      <Bloque titulo="Comisión" ayuda="Solo si la venta le deja una comisión a alguien (ej.: Migue 8%). Por ahora queda anotado.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Comisionista">
            <input name="comisionista" autoCapitalize="characters" placeholder="Ej: MIGUE" defaultValue={v("comisionista")} className={estiloDato} />
          </Campo>
          <Campo etiqueta="Comisión (%)">
            <input name="comisionPct" inputMode="decimal" placeholder="Ej: 8" defaultValue={v("comisionPct")} className={estiloCampo} />
          </Campo>
        </div>
      </Bloque>

      {zonas && (
        <Bloque titulo="Primera sucursal" ayuda="Después se pueden agregar más.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Campo etiqueta="Barrio *">
              <input name="barrio" autoCapitalize="characters" defaultValue={estado?.valores?.barrio ?? ""} required className={estiloDato} />
            </Campo>
            <Campo etiqueta="Dirección *" ayuda="Ej: Malvinas Argentina 2842">
              <input name="direccion" autoCapitalize="words" defaultValue={estado?.valores?.direccion ?? ""} required className={estiloCampo} />
            </Campo>
            <Campo etiqueta="Zona de reparto *">
              <select name="zonaId" defaultValue={estado?.valores?.zonaId ?? ""} required className={estiloCampo}>
                <option value="" disabled hidden>Elegí la zona</option>
                {zonas.map((z) => <option key={z.id} value={z.id}>{z.nombre}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Teléfono">
              <input name="telefono" inputMode="tel" defaultValue={estado?.valores?.telefono ?? ""} className={estiloCampo} />
            </Campo>
          </div>
        </Bloque>
      )}

      <Mensajes estado={estado} />
      <div className="flex justify-end">
        <button disabled={cargando} className="w-full rounded-lg bg-verde-700 px-10 py-3 font-semibold text-white hover:bg-verde-800 disabled:opacity-60 sm:w-auto">{cargando ? "Guardando…" : textoBoton}</button>
      </div>
    </form>
  );
}
