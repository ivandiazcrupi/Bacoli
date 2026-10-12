"use client";

import { useEffect } from "react";

/**
 * Al llegar con ?ver=ID (desde Cuenta corriente, "Ubicar pedido"): baja hasta el pedido, lo deja en el medio de la pantalla
 * y lo resalta unos segundos. Funciona en la hoja de ruta de un día y en la lista de Pedidos (pendientes).
 */
export function UbicarPedido() {
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("ver");
    if (!id) return;
    let intentos = 0;
    const buscar = () => {
      const el = [...document.querySelectorAll<HTMLElement>(`[data-pedido="${CSS.escape(id)}"]`)].find((x) => x.offsetParent !== null); // la fila que se ve (hay una para PC y otra para celular)
      if (!el) { if (++intentos < 10) setTimeout(buscar, 150); return; }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      const antes = el.style.cssText;
      el.style.outline = "3px solid #026433";
      el.style.outlineOffset = "2px";
      el.style.boxShadow = "0 0 0 6px rgba(2,100,51,0.12)";
      el.style.transition = "outline-color .6s, box-shadow .6s";
      setTimeout(() => { el.style.outlineColor = "transparent"; el.style.boxShadow = "none"; }, 4000);
      setTimeout(() => { el.style.cssText = antes; }, 4800);
    };
    setTimeout(buscar, 350); // después de que la pantalla recuperó su altura anterior
  }, []);
  return null;
}
