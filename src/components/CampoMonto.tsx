"use client";

import { useState } from "react";
import { milesEscribiendo } from "@/lib/numeros";

/** Campo de plata que va poniendo el punto de miles mientras se escribe (así se ve si son 10.000 o 100.000). Manda el texto con puntos; `leerMonto` lo entiende. */
export function CampoMonto({ inicial = "", ...resto }: { inicial?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "inputMode">) {
  const [texto, setTexto] = useState(inicial);
  return <input {...resto} inputMode="decimal" value={texto} onChange={(e) => setTexto(milesEscribiendo(e.target.value))} />;
}
