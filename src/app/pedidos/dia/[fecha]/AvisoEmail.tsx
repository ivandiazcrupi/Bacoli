"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enviarAvisosDia } from "../avisos";

/** Botón de la hoja de ruta: manda el aviso "tu pedido llega el … entre las …" a los clientes de la tienda de este día. */
export function AvisoEmail({ fecha, diaTexto, pendientes, avisados, sinEmail, horario }: { fecha: string; diaTexto: string; pendientes: number; avisados: number; sinEmail: number; horario: string }) {
  const router = useRouter();
  const [trabajando, empezar] = useTransition();
  const [mensaje, setMensaje] = useState<{ texto: string; ok: boolean } | null>(null);
  if (pendientes + avisados + sinEmail === 0) return null;
  const enviar = () => {
    if (!horario) { setMensaje({ texto: "Falta cargar el horario en Empresa → Aviso por email.", ok: false }); return; }
    if (!window.confirm(`Se va a mandar un email a ${pendientes} ${pendientes === 1 ? "cliente" : "clientes"} de la tienda:\n\n“Tu pedido llega el ${diaTexto}, ${horario}”\n\n¿Lo enviamos?`)) return;
    empezar(async () => {
      const r = await enviarAvisosDia(fecha);
      setMensaje({ texto: r.mensaje, ok: r.ok });
      router.refresh();
    });
  };
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={trabajando || pendientes === 0} onClick={enviar} className="rounded-md border border-stone-400 bg-white px-3 py-2 font-medium shadow-sm disabled:opacity-50" title={sinEmail ? `${sinEmail} pedido(s) de la tienda no tienen email` : undefined}>
        {trabajando ? "Enviando…" : pendientes ? `Avisar por email (${pendientes})` : `Avisados por email (${avisados})`}
      </button>
      {mensaje && <span className={`text-xs ${mensaje.ok ? "text-stone-700" : "font-semibold text-rojo-700"}`} role="status">{mensaje.texto}</span>}
    </span>
  );
}
