"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buscarDestinos, crearPedido, datosNuevoPedido, type DatosPedido, type Destino } from "./actions";
import { FormularioLineas } from "./FormularioLineas";

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
      {mensaje && <p className="rounded-lg border border-green-600 bg-green-50 p-3 text-sm text-green-700" role="status">{mensaje}</p>}

      {!destino ? (
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            ¿Para qué cliente es el pedido?
            <input
              ref={campo}
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Escribí el cliente, la sucursal o el barrio"
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-4 text-base"
            />
          </label>
          {buscando && <p className="text-sm text-stone-500">Buscando…</p>}
          {!buscando && q.trim() && resultados.length === 0 && <p className="text-sm text-stone-600">No encontré ningún cliente con eso.</p>}
          <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {resultados.map((d) => (
              <li key={d.puntoId}>
                <button type="button" onClick={() => elegir(d)} className="block w-full px-4 py-3 text-left active:bg-stone-100">
                  <span className="block font-medium">{d.cliente}</span>
                  <span className="block text-sm text-stone-600">{[d.alias, d.direccion, d.barrio, d.zona].filter(Boolean).join(" · ")}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 bg-white p-4">
            <div className="min-w-0">
              <p className="font-semibold">{destino.cliente}</p>
              <p className="text-sm text-stone-600">{destino.sucursal}</p>
              <p className="text-xs text-stone-500">{destino.lista ? `Lista ${destino.lista}` : "Sin lista de precios"}</p>
            </div>
            <button type="button" onClick={() => setDestino(null)} className="shrink-0 rounded-lg border border-stone-300 px-3 py-2 text-sm">Cambiar</button>
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
