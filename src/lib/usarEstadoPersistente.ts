"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Como useState, pero el valor se recuerda en la pestaña (sessionStorage) por pantalla:
 * al refrescar (F5) los filtros, el orden y la búsqueda quedan como estaban.
 * Arranca con el valor inicial (para no romper el render del servidor) y lo recupera enseguida.
 */
export function usarEstadoPersistente<T>(nombre: string, inicial: T): [T, Dispatch<SetStateAction<T>>] {
  const [valor, setValor] = useState<T>(inicial);
  const listo = useRef(false);
  const clave = useRef("");

  useEffect(() => {
    clave.current = `estado:${window.location.pathname}:${nombre}`;
    try {
      const guardado = window.sessionStorage.getItem(clave.current);
      if (guardado !== null) setValor(JSON.parse(guardado) as T);
    } catch { /* sin almacenamiento: sigue funcionando sin recordar */ }
    listo.current = true;
  }, [nombre]);

  const poner: Dispatch<SetStateAction<T>> = useCallback((nuevo) => {
    setValor((previo) => {
      const siguiente = typeof nuevo === "function" ? (nuevo as (p: T) => T)(previo) : nuevo;
      if (listo.current) {
        try { window.sessionStorage.setItem(clave.current, JSON.stringify(siguiente)); } catch { /* nada */ }
      }
      return siguiente;
    });
  }, []);

  return [valor, poner];
}
