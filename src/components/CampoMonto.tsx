"use client";

import { useState } from "react";
import { milesEscribiendo } from "@/lib/numeros";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "inputMode"> & {
  inicial?: string;
  /** Si se pasa `valor` + `onValor`, el campo lo maneja quien lo usa (para calcular otras cosas con lo que se escribe). */
  valor?: string;
  onValor?: (texto: string) => void;
};

/** Campo de plata: el signo $ va ADENTRO del recuadro y el punto de miles se pone solo al escribir (así se ve si son 10.000 o 100.000). `leerMonto` entiende el texto. */
export function CampoMonto({ inicial = "", valor, onValor, className = "", ...resto }: Props) {
  const [propio, setPropio] = useState(inicial);
  const texto = valor ?? propio;
  return (
    <span className="relative inline-block max-w-full">
      <span aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-stone-500">$</span>
      <input {...resto} inputMode="decimal" value={texto} onChange={(e) => { const t = milesEscribiendo(e.target.value); setPropio(t); onValor?.(t); }} className={`${className} !pl-6`} />
    </span>
  );
}
