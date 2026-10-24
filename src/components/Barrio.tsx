import { BARRIO_A_COMPLETAR } from "@/lib/barrio";

/** El barrio de un pedido; si está en duda se ve "Completar" en rojo (hay que cambiarlo en el pedido). */
export function Barrio({ v }: { v: string }) {
  return v === BARRIO_A_COMPLETAR ? <span className="font-bold text-rojo-700">Completar</span> : <>{v}</>;
}
