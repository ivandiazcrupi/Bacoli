"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buscarDestinos, crearPedido, datosNuevoPedido, type DatosPedido, type Destino } from "./actions";
import { FormularioLineas } from "./FormularioLineas";

const COLUMNAS = "lg:grid-cols-[1fr_1.6fr_2fr_1fr]";

// Paso 1: escribir y elegir el cliente (y su sucursal) de la lista. Paso 2: cargar productos y cantidades.
export function NuevoPedido({ esDueno }: { esDueno: boolean }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Destino[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [destino, setDestino] = useState<DatosPedido | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!q.trim()) { setResultados([]); return; }
    setBuscando(true);
    const espera = setTimeout(async () => {
      setResultados(await buscarDestinos(q));
      setBuscando(false);
    }, 250);
    return () => clearTimeout(espera);
  }, [q]);

  const elegir = async (d: Destino) => {
    setMensaje(null);
    setDestino(await datosNuevoPedido(d.puntoId));
  };

  const alGuardar = useCallback((texto: string) => {
    setMensaje(texto);
    setDestino(null);
    setQ("");
    setResultados([]);
    setVuelta((v) => v + 1);
    setTimeout(() => campo.current?.focus(), 50);
  }, []);

  return (
    <div className="space-y-4">
      {mensaje && <p className="rounded-lg border border-stone-400 bg-white p-3 text-sm font-medium text-verde-800" role="status">{mensaje}</p>}

      {!destino ? (
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-stone-600">
            ¿Para qué cliente es el pedido?
            <input
              ref={campo}
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Escribí el cliente, la sucursal o el barrio"
              className="mt-1 h-12 w-full rounded-md border border-stone-400 bg-white px-4 text-base font-normal normal-case tracking-normal text-stone-900 shadow-sm focus:border-verde-700 focus:outline-none focus:ring-2 focus:ring-verde-700/25"
            />
          </label>
          {buscando && <p className="text-sm text-stone-500">Buscando…</p>}
          {!buscando && q.trim() && resultados.length === 0 && <p className="text-sm text-stone-600">No encontré ningún cliente con eso.</p>}
          {resultados.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm">
              <div className={`hidden gap-x-4 border-b border-stone-400 px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-stone-600 lg:grid ${COLUMNAS}`}>
                <span>Barrio</span><span>Cliente</span><span>Dirección</span><span>Zona</span>
              </div>
              {resultados.map((d) => (
                <button key={d.puntoId} type="button" onClick={() => elegir(d)} className={`grid w-full items-center gap-x-4 gap-y-0.5 border-t border-stone-300 px-5 py-2.5 text-center first:border-t-0 hover:bg-crema-100 ${COLUMNAS}`}>
                  <span className="font-semibold">{d.barrio}</span>
                  <span className="font-semibold">{d.cliente}</span>
                  <span className="text-sm">{[d.alias, d.direccion].filter(Boolean).join(" · ")}</span>
                  <span className="text-sm text-stone-600">{d.zona}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-300 bg-white px-5 py-3 shadow-sm">
            <p className="min-w-0">
              <span className="font-bold">{destino.cliente}</span>
              <span className="text-stone-600"> · {destino.sucursal}</span>
              <span className="text-sm text-stone-500"> · {destino.lista ? `Lista ${destino.lista}` : "Sin lista de precios"}</span>
            </p>
            <button type="button" onClick={() => setDestino(null)} className="shrink-0 rounded-md border border-stone-400 bg-white px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-crema-100">Cambiar cliente</button>
          </div>
          <FormularioLineas
            key={`${destino.puntoId}-${vuelta}`}
            accion={crearPedido}
            puntoId={destino.puntoId}
            productos={destino.productos.map((p) => ({ ...p, cantidad: 0 }))}
            conFacturaInicial={destino.facturado}
            notaInicial=""
            esDueno={esDueno}
            textoBoton="Guardar pedido"
            alGuardar={alGuardar}
          />
        </div>
      )}
    </div>
  );
}
