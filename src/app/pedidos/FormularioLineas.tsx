"use client";

import { useActionState, useEffect, useState } from "react";
import { Mensajes, estiloBoton } from "@/components/campos";
import { IVA_PCT } from "@/lib/cuenta";
import { formatoPesos, leerMonto } from "@/lib/numeros";
import type { EstadoPedidoForm } from "./actions";

export type LineaProducto = { id: string; nombre: string; sku: string | null; unidad: string; precio: string | null; cantidad: number; sinCargo?: number; motivoSinCargo?: string | null; bonificacion?: string };

const MOTIVOS = ["Recambio", "Bonificación", "Muestra", "Otro"];

type Props = {
  accion: (estado: EstadoPedidoForm, formData: FormData) => Promise<EstadoPedidoForm>;
  puntoId: string;
  productos: LineaProducto[];
  conFacturaInicial: boolean;
  notaInicial: string;
  envioInicial?: string;
  esDueno: boolean;
  textoBoton: string;
  alGuardar?: (mensaje: string) => void;
};

const boton = "flex h-11 w-11 items-center justify-center rounded-md border border-stone-400 bg-white text-xl font-medium hover:bg-crema-100 lg:h-9 lg:w-9 lg:text-lg";
const COLUMNAS = "lg:grid-cols-[minmax(0,2fr)_5rem_9rem_11rem_6rem_9rem]";

// Productos con cantidad y precio, en una tabla a lo ancho. Al tocar + / − o escribir el número, el total se calcula al instante.
export function FormularioLineas({ accion, puntoId, productos, conFacturaInicial, notaInicial, envioInicial = "", esDueno, textoBoton, alGuardar }: Props) {
  const [estado, enviar, cargando] = useActionState(accion, undefined);
  const [cantidades, setCantidades] = useState<Record<string, string>>(() => Object.fromEntries(productos.map((p) => [p.id, p.cantidad ? String(p.cantidad) : ""])));
  const [precios, setPrecios] = useState<Record<string, string>>(() => Object.fromEntries(productos.map((p) => [p.id, p.precio ?? ""])));
  const [sinCargos, setSinCargos] = useState<Record<string, string>>(() => Object.fromEntries(productos.map((p) => [p.id, p.sinCargo ? String(p.sinCargo) : ""])));
  const [motivos, setMotivos] = useState<Record<string, string>>(() => Object.fromEntries(productos.map((p) => [p.id, p.motivoSinCargo ?? ""])));
  const [nuevo, setNuevo] = useState({ producto: "", cantidad: 1, motivo: "" });
  const [errorSc, setErrorSc] = useState<string | null>(null);
  const [bonifs, setBonifs] = useState<Record<string, string>>(() => Object.fromEntries(productos.map((p) => [p.id, p.bonificacion ?? ""])));
  const [conFactura, setConFactura] = useState(conFacturaInicial);
  const [envio, setEnvio] = useState(envioInicial);

  useEffect(() => {
    if (estado?.ok) alGuardar?.(estado.ok);
  }, [estado, alGuardar]);

  const cantidad = (id: string) => Number(cantidades[id]?.replace(/\D/g, "") || 0);
  const cambiar = (id: string, delta: number) => setCantidades((c) => ({ ...c, [id]: String(Math.max(0, cantidad(id) + delta) || "") }));
  const sinCargo = (id: string) => Number(sinCargos[id]?.replace(/\D/g, "") || 0);
  const lineasSc = productos.filter((p) => sinCargo(p.id) > 0);
  const valorSc = lineasSc.reduce((t, p) => t + sinCargo(p.id) * (leerMonto(precios[p.id]) ?? 0), 0);
  const paquetesSc = lineasSc.reduce((t, p) => t + sinCargo(p.id), 0);
  const agregarSc = () => {
    setErrorSc(null);
    if (!nuevo.producto) return setErrorSc("Elegí el producto.");
    if (nuevo.cantidad < 1) return setErrorSc("La cantidad tiene que ser al menos 1.");
    if (!nuevo.motivo) return setErrorSc("Elegí el motivo.");
    setSinCargos((c) => ({ ...c, [nuevo.producto]: String(nuevo.cantidad) }));
    setMotivos((m) => ({ ...m, [nuevo.producto]: nuevo.motivo }));
    setNuevo({ producto: "", cantidad: 1, motivo: "" });
  };
  const quitarSc = (id: string) => {
    setSinCargos((c) => ({ ...c, [id]: "" }));
    setMotivos((m) => ({ ...m, [id]: "" }));
  };
  // Antes de guardar: si lo regalado de un producto es más que lo que se cobra de ese producto, se pide confirmar (evita el dedazo).
  const confirmarSc = (e: React.FormEvent) => {
    const raro = lineasSc.filter((p) => sinCargo(p.id) > Math.max(cantidad(p.id), 1));
    if (raro.length === 0) return;
    const texto = raro.map((p) => `${sinCargo(p.id)} ${p.nombre} sin cargo (se cobran ${cantidad(p.id)})`).join("\n");
    if (!window.confirm(`Revisá: se entrega más sin cargo que lo que se cobra.\n\n${texto}\n\n¿Está bien así?`)) e.preventDefault();
  };
  const bonif = (id: string) => Math.min(100, Math.max(0, leerMonto(bonifs[id]) ?? 0));
  const importe = (id: string) => cantidad(id) * (leerMonto(precios[id]) ?? 0) * (1 - bonif(id) / 100);
  const bruto = productos.reduce((s, p) => s + cantidad(p.id) * (leerMonto(precios[p.id]) ?? 0), 0);
  const montoEnvio = Math.max(0, leerMonto(envio) ?? 0);
  const subtotalProductos = productos.reduce((s, p) => s + importe(p.id), 0);
  const subtotal = subtotalProductos + montoEnvio;
  const descuento = bruto - subtotalProductos;
  const iva = conFactura ? subtotal * (IVA_PCT / 100) : 0;
  const ivaTexto = String(IVA_PCT).replace(".", ",");

  return (
    <form action={enviar} onSubmit={confirmarSc} className="space-y-4">
      <input type="hidden" name="puntoId" value={puntoId} />
      <input type="hidden" name="conFactura" value={conFactura ? "1" : "0"} />
      {lineasSc.map((p) => (
        <span key={p.id}>
          <input type="hidden" name={`sc_${p.id}`} value={sinCargo(p.id)} />
          <input type="hidden" name={`scm_${p.id}`} value={motivos[p.id] ?? ""} />
        </span>
      ))}

      <div className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm">
        <div className={`hidden gap-x-4 px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-stone-600 lg:grid ${COLUMNAS}`}>
          <span>Producto</span><span>Unidad</span><span>Precio</span><span>Cantidad</span><span>Bonif. %</span><span>Subtotal</span>
        </div>
        {productos.map((p) => {
          const sc = sinCargo(p.id);
          const q = cantidad(p.id);
          const precio = leerMonto(precios[p.id]) ?? 0;
          const sinPrecio = q > 0 && !precio;
          return (
            <div key={p.id} className={`grid items-center gap-x-4 gap-y-2 border-t border-stone-400 px-5 py-2.5 text-center ${COLUMNAS} ${q > 0 || sc > 0 ? "bg-crema-50" : "bg-white"}`}>
              <div>
                <p className="font-semibold leading-snug">{p.nombre}</p>
                <p className="text-xs text-stone-500">{p.sku ?? ""}</p>
              </div>
              <p className="text-sm text-stone-600">{p.unidad}</p>
              <label className="flex items-center justify-center gap-1.5 text-sm text-stone-600 lg:block">
                <span className="lg:hidden">Precio</span>
                <span className="relative inline-block">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true">$</span>
                  <input
                    name={`pr_${p.id}`}
                    aria-label={`Precio de ${p.nombre}`}
                    inputMode="decimal"
                    value={precios[p.id] ?? ""}
                    onChange={(e) => setPrecios((x) => ({ ...x, [p.id]: e.target.value }))}
                    className={`h-9 w-32 rounded-md border bg-white pl-5 pr-2 text-center tabular-nums text-stone-900 ${sinPrecio ? "border-rojo-600" : "border-stone-400"}`}
                  />
                </span>
              </label>
              <div className="flex items-center justify-center gap-1">
                <button type="button" className={boton} onClick={() => cambiar(p.id, -1)} aria-label={`Menos ${p.nombre}`}>−</button>
                <input
                  name={`q_${p.id}`}
                  aria-label={`Cantidad de ${p.nombre}`}
                  inputMode="numeric"
                  value={cantidades[p.id] ?? ""}
                  onChange={(e) => setCantidades((c) => ({ ...c, [p.id]: e.target.value.replace(/\D/g, "") }))}
                  placeholder="0"
                  className="h-11 w-16 rounded-md border border-stone-400 bg-white text-center text-lg tabular-nums lg:h-9 lg:text-base"
                />
                <button type="button" className={boton} onClick={() => cambiar(p.id, 1)} aria-label={`Más ${p.nombre}`}>+</button>
              </div>
              <label className="flex items-center justify-center gap-1.5 text-sm text-stone-600 lg:block">
                <span className="lg:hidden">Bonif. %</span>
                <input
                  name={`bd_${p.id}`}
                  aria-label={`Bonificación en % de ${p.nombre}`}
                  inputMode="decimal"
                  value={bonifs[p.id] ?? ""}
                  onChange={(e) => setBonifs((c) => ({ ...c, [p.id]: e.target.value }))}
                  placeholder="0"
                  className="h-9 w-16 rounded-md border border-stone-400 bg-white text-center tabular-nums text-stone-900"
                />
              </label>
              <p className="text-sm font-semibold tabular-nums">
                {sinPrecio ? <span className="text-xs font-medium text-rojo-700">Falta el precio</span> : q > 0 ? formatoPesos(importe(p.id)) : sc > 0 ? <span className="text-xs font-medium text-stone-600">{sc} sin cargo</span> : <span className="font-normal text-stone-400">—</span>}
              </p>
            </div>
          );
        })}
      </div>

      {/* Sin cargo: se agrega a propósito (producto + cantidad + motivo) y queda a la vista con su valor; nada se escribe suelto en la tabla. */}
      <section className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm" aria-label="Paquetes sin cargo">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-stone-600">Sin cargo · recambios y regalos</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <select aria-label="Producto sin cargo" value={nuevo.producto} onChange={(e) => setNuevo((n) => ({ ...n, producto: e.target.value }))} className="h-10 min-w-56 rounded-md border border-stone-400 bg-white px-2 text-sm">
            <option value="" disabled hidden>Producto…</option>
            {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <div className="flex items-center gap-1">
            <button type="button" className={boton} onClick={() => setNuevo((n) => ({ ...n, cantidad: Math.max(1, n.cantidad - 1) }))} aria-label="Menos">−</button>
            <input aria-label="Cantidad sin cargo" inputMode="numeric" value={nuevo.cantidad} onChange={(e) => setNuevo((n) => ({ ...n, cantidad: Number(e.target.value.replace(/\D/g, "")) || 0 }))} className="h-9 w-16 rounded-md border border-stone-400 bg-white text-center tabular-nums" />
            <button type="button" className={boton} onClick={() => setNuevo((n) => ({ ...n, cantidad: n.cantidad + 1 }))} aria-label="Más">+</button>
          </div>
          <select aria-label="Motivo" value={nuevo.motivo} onChange={(e) => setNuevo((n) => ({ ...n, motivo: e.target.value }))} className="h-10 rounded-md border border-stone-400 bg-white px-2 text-sm">
            <option value="" disabled hidden>Motivo…</option>
            {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <button type="button" onClick={agregarSc} className="h-10 rounded-md border border-stone-800 bg-stone-800 px-4 text-sm font-semibold text-white hover:bg-stone-700">+ Agregar sin cargo</button>
        </div>
        {errorSc && <p className="mt-2 text-center text-sm text-rojo-700" role="alert">{errorSc}</p>}
        {lineasSc.length > 0 && (
          <ul className="mt-3 divide-y divide-stone-300 overflow-hidden rounded-lg border border-stone-300 text-sm">
            {lineasSc.map((p) => (
              <li key={p.id} className="grid grid-cols-[4rem_1fr_9rem_9rem_2.5rem] items-center gap-x-3 bg-crema-50 px-3 py-2 text-center">
                <b className="tabular-nums">{sinCargo(p.id)}</b>
                <span className="font-semibold">{p.nombre}</span>
                <span className="text-stone-700">{motivos[p.id]}</span>
                <span className="tabular-nums text-stone-600">{formatoPesos(sinCargo(p.id) * (leerMonto(precios[p.id]) ?? 0))}</span>
                <button type="button" onClick={() => quitarSc(p.id)} aria-label={`Quitar ${p.nombre} sin cargo`} className="text-lg text-stone-500 hover:text-rojo-700">✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_1fr_11rem_20rem]">
        <div className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-600">Comprobante</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de comprobante">
            {[
              { valor: false, texto: "Con remito" },
              { valor: true, texto: `Con factura (+${ivaTexto}% IVA)` },
            ].map((o) => (
              <button
                key={String(o.valor)}
                type="button"
                aria-pressed={conFactura === o.valor}
                onClick={() => setConFactura(o.valor)}
                className={`rounded-md border px-3 py-2.5 text-sm font-medium ${conFactura === o.valor ? "border-stone-800 bg-stone-800 text-white" : "border-stone-400 bg-white hover:bg-crema-100"}`}
              >
                {o.texto}
              </button>
            ))}
          </div>
        </div>

        <label className="flex flex-col rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
          <span className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-600">Nota importante (se ve en rojo en la ruta)</span>
          <input name="nota" defaultValue={notaInicial} placeholder="Ej.: Entregar en el vecino" className="w-full rounded-md border border-stone-400 bg-white px-3 py-2.5 text-base" />
        </label>

        <label className="flex flex-col rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
          <span className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-600">Envío (si se cobra)</span>
          <span className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true">$</span>
            <input name="envio" inputMode="decimal" value={envio} onChange={(e) => setEnvio(e.target.value)} placeholder="0" aria-label="Monto del envío" className="w-full rounded-md border border-stone-400 bg-white py-2.5 pl-7 pr-3 text-center text-base tabular-nums" />
          </span>
        </label>

        <div className="rounded-xl border border-stone-300 bg-white p-4 text-sm shadow-sm">
          {(descuento > 0.004 || conFactura || montoEnvio > 0) && <div className="flex justify-between"><span className="text-stone-600">Subtotal</span><span className="tabular-nums">{formatoPesos(bruto)}</span></div>}
          {descuento > 0.004 && <div className="flex justify-between text-rojo-700"><span>Bonificación</span><span className="tabular-nums">−{formatoPesos(descuento)}</span></div>}
          {montoEnvio > 0 && <div className="flex justify-between"><span className="text-stone-600">Envío</span><span className="tabular-nums">{formatoPesos(montoEnvio)}</span></div>}
          {(descuento > 0.004 || montoEnvio > 0) && conFactura && <div className="flex justify-between"><span className="text-stone-600">Neto</span><span className="tabular-nums">{formatoPesos(subtotal)}</span></div>}
          {conFactura && <div className="flex justify-between"><span className="text-stone-600">IVA {ivaTexto}%</span><span className="tabular-nums">{formatoPesos(iva)}</span></div>}
          <div className="mt-1 flex justify-between border-t border-stone-300 pt-2 text-lg font-bold"><span>Total</span><span className="tabular-nums">{formatoPesos(subtotal + iva)}</span></div>
          {paquetesSc > 0 && <p className="mt-1 border-t border-stone-300 pt-1.5 text-xs text-stone-600">Sin cargo: <b>{paquetesSc}</b> {paquetesSc === 1 ? "paquete" : "paquetes"} · valor {formatoPesos(valorSc)} (no se cobra)</p>}
          <button disabled={cargando} className={`${estiloBoton} mt-3`}>{cargando ? "Guardando…" : textoBoton}</button>
        </div>
      </div>

      {estado?.aviso && (
        <div className="space-y-3 rounded-lg border border-rojo-600 bg-rojo-50 p-4 text-sm">
          <p>{estado.aviso}</p>
          {esDueno && <button name="autorizar" value="1" disabled={cargando} className={`${estiloBoton} lg:w-auto lg:px-6`}>Autorizar y guardar el pedido</button>}
        </div>
      )}
      <Mensajes estado={estado} />
    </form>
  );
}
