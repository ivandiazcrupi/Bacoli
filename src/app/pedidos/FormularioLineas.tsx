"use client";

import { Fragment, useActionState, useEffect, useState } from "react";
import { Mensajes, estiloBoton } from "@/components/campos";
import { IVA_ENVIO } from "@/lib/cuenta";
import { formatoPesos, leerMonto } from "@/lib/numeros";
import type { EstadoPedidoForm } from "./actions";

export type LineaProducto = { id: string; nombre: string; sku: string | null; unidad: string; precio: string | null; iva?: string; cantidad: number; sinCargo?: number; motivoSinCargo?: string | null; bonificacion?: string };

const MOTIVOS = ["Recambio", "Bonificación", "Muestra", "Otro"];

/** Un renglón escrito a mano (cualquier cosa que no está en la lista de productos): nombre libre, cantidad, precio e IVA. */
export type Manual = { nombre: string; cantidad: string; precio: string; iva: string; unidad: string };
const MANUAL_VACIO: Manual = { nombre: "", cantidad: "", precio: "", iva: "0", unidad: "paquete" };
// Siempre queda un renglón vacío al final: apenas se escribe en el último, aparece otro.
const conVacio = (l: Manual[]) => (l.length === 0 || l[l.length - 1].nombre.trim() ? [...l, { ...MANUAL_VACIO }] : l);

type Props = {
  accion: (estado: EstadoPedidoForm, formData: FormData) => Promise<EstadoPedidoForm>;
  puntoId: string;
  productos: LineaProducto[];
  conFacturaInicial: boolean;
  notaInicial: string;
  envioInicial?: string;
  manualesIniciales?: Manual[]; // renglones escritos a mano que ya tenía el pedido (al editarlo)
  esDueno: boolean;
  textoBoton: string;
  alGuardar?: (mensaje: string) => void;
};

const boton = "flex h-11 w-11 items-center justify-center rounded-md border border-stone-400 bg-white text-xl font-medium hover:bg-crema-100 lg:h-9 lg:w-9 lg:text-lg";
const COLUMNAS_SIN_IVA = "lg:grid-cols-[minmax(0,2fr)_5rem_9rem_11rem_6rem_9rem]";
const COLUMNAS_CON_IVA = "lg:grid-cols-[minmax(0,2fr)_5rem_9rem_11rem_6rem_9rem_6.5rem]"; // con factura se agrega la columna IVA, a la derecha de todo

// Productos con cantidad y precio, en una tabla a lo ancho. Al tocar + / − o escribir el número, el total se calcula al instante.
export function FormularioLineas({ accion, puntoId, productos, conFacturaInicial, notaInicial, envioInicial = "", manualesIniciales = [], esDueno, textoBoton, alGuardar }: Props) {
  const [estado, enviar, cargando] = useActionState(accion, undefined);
  const [cantidades, setCantidades] = useState<Record<string, string>>(() => Object.fromEntries(productos.map((p) => [p.id, p.cantidad ? String(p.cantidad) : ""])));
  const [precios, setPrecios] = useState<Record<string, string>>(() => Object.fromEntries(productos.map((p) => [p.id, p.precio ?? ""])));
  const [sinCargos, setSinCargos] = useState<Record<string, string>>(() => Object.fromEntries(productos.map((p) => [p.id, p.sinCargo ? String(p.sinCargo) : ""])));
  const [motivos, setMotivos] = useState<Record<string, string>>(() => Object.fromEntries(productos.map((p) => [p.id, p.motivoSinCargo ?? ""])));
  const [edit, setEdit] = useState<{ id: string; cantidad: number; motivo: string } | null>(null); // el sin cargo que se está cargando o cambiando
  const [errorSc, setErrorSc] = useState<string | null>(null);
  const [bonifs, setBonifs] = useState<Record<string, string>>(() => Object.fromEntries(productos.map((p) => [p.id, p.bonificacion ?? ""])));
  const [conFactura, setConFactura] = useState(conFacturaInicial);
  const [envio, setEnvio] = useState(envioInicial);
  const [manuales, setManuales] = useState<Manual[]>(() => conVacio(manualesIniciales));
  const cambiarManual = (i: number, cambio: Partial<Manual>) => setManuales((l) => conVacio(l.map((m, k) => (k === i ? { ...m, ...cambio } : m))));
  const cantManual = (m: Manual) => Number(m.cantidad.replace(/\D/g, "") || 0);
  const importeManual = (m: Manual) => (m.nombre.trim() ? cantManual(m) * (leerMonto(m.precio) ?? 0) : 0);
  const [ivas, setIvas] = useState<Record<string, string>>(() => Object.fromEntries(productos.map((p) => [p.id, p.iva ?? "0"])));

  useEffect(() => {
    if (estado?.ok) alGuardar?.(estado.ok);
  }, [estado, alGuardar]);

  const cantidad = (id: string) => Number(cantidades[id]?.replace(/\D/g, "") || 0);
  const cambiar = (id: string, delta: number) => setCantidades((c) => ({ ...c, [id]: String(Math.max(0, cantidad(id) + delta) || "") }));
  const sinCargo = (id: string) => Number(sinCargos[id]?.replace(/\D/g, "") || 0);
  const lineasSc = productos.filter((p) => sinCargo(p.id) > 0);
  const valorSc = lineasSc.reduce((t, p) => t + sinCargo(p.id) * (leerMonto(precios[p.id]) ?? 0), 0);
  const paquetesSc = lineasSc.reduce((t, p) => t + sinCargo(p.id), 0);
  const abrirSc = (id: string) => { setErrorSc(null); setEdit({ id, cantidad: sinCargo(id) || 1, motivo: motivos[id] ?? "" }); };
  const guardarSc = () => {
    if (!edit) return;
    setErrorSc(null);
    if (edit.cantidad < 1) return setErrorSc("La cantidad sin cargo tiene que ser al menos 1.");
    if (!edit.motivo) return setErrorSc("Elegí el motivo del sin cargo.");
    setSinCargos((c) => ({ ...c, [edit.id]: String(edit.cantidad) }));
    setMotivos((m) => ({ ...m, [edit.id]: edit.motivo }));
    setEdit(null);
  };
  const quitarSc = (id: string) => {
    setSinCargos((c) => ({ ...c, [id]: "" }));
    setMotivos((m) => ({ ...m, [id]: "" }));
    setEdit(null);
  };
  // Antes de guardar: si lo regalado de un producto es más que lo que se cobra de ese producto, se pide confirmar (evita el dedazo).
  const confirmarSc = (e: React.FormEvent) => {
    if (edit) { e.preventDefault(); setErrorSc("Terminá de cargar el sin cargo: tocá “Agregar” o “Cancelar”."); return; }
    const raro = lineasSc.filter((p) => sinCargo(p.id) > Math.max(cantidad(p.id), 1));
    if (raro.length === 0) return;
    const texto = raro.map((p) => `${sinCargo(p.id)} ${p.nombre} sin cargo (se cobran ${cantidad(p.id)})`).join("\n");
    if (!window.confirm(`Revisá: se entrega más sin cargo que lo que se cobra.\n\n${texto}\n\n¿Está bien así?`)) e.preventDefault();
  };
  const bonif = (id: string) => Math.min(100, Math.max(0, leerMonto(bonifs[id]) ?? 0));
  const importe = (id: string) => cantidad(id) * (leerMonto(precios[id]) ?? 0) * (1 - bonif(id) / 100);
  const totalManuales = manuales.reduce((t, m) => t + importeManual(m), 0);
  const bruto = productos.reduce((s, p) => s + cantidad(p.id) * (leerMonto(precios[p.id]) ?? 0), 0) + totalManuales;
  const montoEnvio = Math.max(0, leerMonto(envio) ?? 0);
  const subtotalProductos = productos.reduce((s, p) => s + importe(p.id), 0) + totalManuales;
  const subtotal = subtotalProductos + montoEnvio;
  const descuento = bruto - subtotalProductos;
  // IVA por renglón (cada producto a su tasa; el envío siempre al 21%), separado por tasa como en la factura.
  const tasaDe = (id: string) => leerMonto(ivas[id]) ?? 0;
  const porTasa = new Map<number, number>();
  for (const p of productos) if (importe(p.id) > 0) porTasa.set(tasaDe(p.id), (porTasa.get(tasaDe(p.id)) ?? 0) + importe(p.id));
  for (const m of manuales) if (importeManual(m) > 0) { const t = leerMonto(m.iva) ?? 0; porTasa.set(t, (porTasa.get(t) ?? 0) + importeManual(m)); }
  if (montoEnvio > 0) porTasa.set(IVA_ENVIO, (porTasa.get(IVA_ENVIO) ?? 0) + montoEnvio);
  const lineasIva = conFactura ? [...porTasa.entries()].sort((a, b) => a[0] - b[0]).map(([tasa, base]) => ({ tasa, iva: (base * tasa) / 100 })) : [];
  const iva = lineasIva.reduce((t, l) => t + l.iva, 0);
  const COLUMNAS = conFactura ? COLUMNAS_CON_IVA : COLUMNAS_SIN_IVA;
  const ivaTexto = (t: number) => String(t).replace(".", ",");

  return (
    <form action={enviar} onSubmit={confirmarSc} className="space-y-4">
      <input type="hidden" name="puntoId" value={puntoId} />
      <input type="hidden" name="conFactura" value={conFactura ? "1" : "0"} />
      <input type="hidden" name="m_total" value={manuales.length} />
      {lineasSc.map((p) => (
        <span key={p.id}>
          <input type="hidden" name={`sc_${p.id}`} value={sinCargo(p.id)} />
          <input type="hidden" name={`scm_${p.id}`} value={motivos[p.id] ?? ""} />
        </span>
      ))}

      <div className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm">
        <div className={`hidden gap-x-4 px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-stone-600 lg:grid ${COLUMNAS}`}>
          <span>Producto</span><span>Unidad</span><span>Precio</span><span>Cantidad</span><span>Bonif. %</span><span>Subtotal</span>{conFactura && <span>IVA</span>}
        </div>
        {productos.map((p) => {
          const sc = sinCargo(p.id);
          const q = cantidad(p.id);
          const precio = leerMonto(precios[p.id]) ?? 0;
          const sinPrecio = q > 0 && !precio;
          const editando = edit?.id === p.id;
          return (
            <Fragment key={p.id}>
            <div className={`grid items-center gap-x-4 gap-y-2 border-t border-stone-400 px-5 py-2.5 text-center ${COLUMNAS} ${q > 0 || sc > 0 ? "bg-crema-50" : "bg-white"}`}>
              <div>
                <p className="font-semibold leading-snug">{p.nombre}</p>
                <p className="text-xs text-stone-500">{p.sku ?? ""}{sc === 0 && !editando && <> · <button type="button" onClick={() => abrirSc(p.id)} className="underline hover:text-stone-900">+ sin cargo</button></>}</p>
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
                {sinPrecio ? <span className="text-xs font-medium text-rojo-700">Falta el precio</span> : q > 0 ? formatoPesos(importe(p.id)) : <span className="font-normal text-stone-400">—</span>}
              </p>
              {conFactura && (
                <label className="flex items-center justify-center gap-1.5 text-sm text-stone-600 lg:block">
                  <span className="lg:hidden">IVA</span>
                  <select name={`iva_${p.id}`} aria-label={`IVA de ${p.nombre}`} value={ivas[p.id] ?? "0"} onChange={(e) => setIvas((c) => ({ ...c, [p.id]: e.target.value }))} className="h-9 w-[5.25rem] rounded-md border border-stone-400 bg-white px-1 text-center text-stone-900">
                    {[...new Set(["0", "10,5", "21", ivas[p.id] ?? "0"])].map((t) => <option key={t} value={t}>{t}%</option>)}
                  </select>
                </label>
              )}
            </div>
            {(sc > 0 || editando) && (
              <div className={`grid items-center gap-x-4 gap-y-1 border-t border-dashed border-stone-300 bg-crema-50 px-5 py-1.5 text-center text-sm ${COLUMNAS}`}>
                {editando ? (
                  <>
                    <select aria-label={`Motivo del sin cargo de ${p.nombre}`} value={edit.motivo} onChange={(e) => setEdit({ ...edit, motivo: e.target.value })} className="mx-auto h-8 w-44 rounded-md border border-stone-400 bg-white px-2 text-sm">
                      <option value="" disabled hidden>Motivo…</option>
                      {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <span className="text-stone-600">{p.unidad}</span>
                    <span className="text-stone-500">Sin cargo</span>
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" className={boton} onClick={() => setEdit({ ...edit, cantidad: Math.max(1, edit.cantidad - 1) })} aria-label="Menos sin cargo">−</button>
                      <input aria-label={`Cantidad sin cargo de ${p.nombre}`} inputMode="numeric" value={edit.cantidad} onChange={(e) => setEdit({ ...edit, cantidad: Number(e.target.value.replace(/\D/g, "")) || 0 })} className="h-9 w-16 rounded-md border border-stone-400 bg-white text-center tabular-nums" />
                      <button type="button" className={boton} onClick={() => setEdit({ ...edit, cantidad: edit.cantidad + 1 })} aria-label="Más sin cargo">+</button>
                    </div>
                    <span />
                    <span className="flex items-center justify-center gap-2">
                      <button type="button" onClick={guardarSc} className="h-8 rounded-md bg-stone-800 px-3 text-xs font-semibold text-white hover:bg-stone-700">Agregar</button>
                      <button type="button" onClick={() => setEdit(null)} className="text-xs text-stone-500 underline hover:text-stone-900">Cancelar</button>
                    </span>
                    {conFactura && <span />}
                  </>
                ) : (
                  <>
                    <span className="text-stone-700">↳ Sin cargo · {motivos[p.id]} <button type="button" onClick={() => abrirSc(p.id)} className="ml-1 text-xs text-stone-500 underline hover:text-stone-900">cambiar</button></span>
                    <span className="text-stone-600">{p.unidad}</span>
                    <span className="text-stone-500">Sin cargo</span>
                    <span className="font-semibold tabular-nums">{sc}</span>
                    <span />
                    <span className="flex items-center justify-center gap-2 tabular-nums text-stone-600">{formatoPesos(0)}<button type="button" onClick={() => quitarSc(p.id)} aria-label={`Quitar ${p.nombre} sin cargo`} className="text-base text-stone-500 hover:text-rojo-700">✕</button></span>
                    {conFactura && <span />}
                  </>
                )}
              </div>
            )}
            </Fragment>
          );
        })}
        {/* Renglones libres: cualquier cosa que no está en la lista (se escribe el nombre, la cantidad y el precio). Siempre queda uno vacío. */}
        {manuales.map((m, i) => {
          const q = cantManual(m);
          const usado = m.nombre.trim() !== "";
          const sinPrecioM = usado && q > 0 && !(leerMonto(m.precio) ?? 0);
          return (
            <div key={i} className={`grid items-center gap-x-4 gap-y-2 border-t border-stone-400 px-5 py-2.5 text-center ${COLUMNAS} ${usado ? "bg-crema-50" : "bg-white"}`}>
              <input name={`mn_${i}`} aria-label="Otro producto (escribilo)" placeholder="Otro producto (escribilo)" maxLength={80} value={m.nombre} onChange={(e) => cambiarManual(i, { nombre: e.target.value, ...(!m.cantidad && e.target.value.trim() ? { cantidad: "1" } : {}) })} className="h-10 w-full rounded-md border border-dashed border-stone-400 bg-white px-3 text-center text-base font-semibold text-stone-900 focus:border-verde-700 focus:outline-none" />
              <label className="flex items-center justify-center gap-1.5 text-sm text-stone-600 lg:block">
                <span className="lg:hidden">Se pide por</span>
                <select name={`mu_${i}`} aria-label="Se pide por paquete o por unidad" value={m.unidad} onChange={(e) => cambiarManual(i, { unidad: e.target.value })} className="h-9 w-28 rounded-md border border-stone-400 bg-white px-1 text-center text-stone-900">
                  <option value="paquete">Paquete</option>
                  <option value="unidad">Unidad</option>
                </select>
              </label>
              <label className="flex items-center justify-center gap-1.5 text-sm text-stone-600 lg:block">
                <span className="lg:hidden">Precio</span>
                <span className="relative inline-block">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden="true">$</span>
                  <input name={`mp_${i}`} aria-label="Precio del otro producto" inputMode="decimal" value={m.precio} onChange={(e) => cambiarManual(i, { precio: e.target.value })} className={`h-9 w-32 rounded-md border bg-white pl-5 pr-2 text-center tabular-nums text-stone-900 ${sinPrecioM ? "border-rojo-600" : "border-stone-400"}`} />
                </span>
              </label>
              <div className="flex items-center justify-center gap-1">
                <button type="button" className={boton} onClick={() => cambiarManual(i, { cantidad: String(Math.max(0, q - 1) || "") })} aria-label="Menos otro producto">−</button>
                <input name={`mc_${i}`} aria-label="Cantidad del otro producto" inputMode="numeric" value={m.cantidad} onChange={(e) => cambiarManual(i, { cantidad: e.target.value.replace(/\D/g, "") })} placeholder="0" className="h-11 w-16 rounded-md border border-stone-400 bg-white text-center text-lg tabular-nums lg:h-9 lg:text-base" />
                <button type="button" className={boton} onClick={() => cambiarManual(i, { cantidad: String(q + 1) })} aria-label="Más otro producto">+</button>
              </div>
              <span className="text-stone-300">—</span>
              <p className="text-sm font-semibold tabular-nums">{sinPrecioM ? <span className="text-xs font-medium text-rojo-700">Falta el precio</span> : usado && q > 0 ? formatoPesos(importeManual(m)) : <span className="font-normal text-stone-400">—</span>}</p>
              {conFactura && (
                <label className="flex items-center justify-center gap-1.5 text-sm text-stone-600 lg:block">
                  <span className="lg:hidden">IVA</span>
                  <select name={`mi_${i}`} aria-label="IVA del otro producto" value={m.iva} onChange={(e) => cambiarManual(i, { iva: e.target.value })} className="h-9 w-[5.25rem] rounded-md border border-stone-400 bg-white px-1 text-center text-stone-900">
                    {[...new Set(["0", "10,5", "21", m.iva])].map((t) => <option key={t} value={t}>{t}%</option>)}
                  </select>
                </label>
              )}
            </div>
          );
        })}
      </div>

      {errorSc && <p className="text-center text-sm text-rojo-700" role="alert">{errorSc}</p>}

      <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_1fr_11rem_20rem]">
        <div className="rounded-xl border border-stone-300 bg-white p-4 shadow-sm">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-600">Comprobante</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de comprobante">
            {[
              { valor: false, texto: "Con remito" },
              { valor: true, texto: `Con factura (+ IVA)` },
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
          {lineasIva.map((l) => <div key={l.tasa} className="flex justify-between"><span className="text-stone-600">IVA {ivaTexto(l.tasa)}%</span><span className="tabular-nums">{formatoPesos(l.iva)}</span></div>)}
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
