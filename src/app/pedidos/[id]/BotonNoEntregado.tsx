"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ModalMotivo } from "@/components/ModalMotivo";
import { registrarNoEntrega } from "../dia/actions";

// "No entregado" desde el detalle del pedido: pide el motivo y el pedido vuelve a Pedidos para reprogramarlo.
export function BotonNoEntregado({ pedidoId, clase }: { pedidoId: string; clase: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, empezar] = useTransition();
  return (
    <>
      <button type="button" onClick={() => { setError(null); setAbierto(true); }} className={clase}>✗ No entregado</button>
      <ModalMotivo
        abierto={abierto}
        titulo="¿Por qué no se entregó?"
        ayuda="El pedido vuelve a Pedidos para reprogramarlo, y en la hoja de ruta de ese día queda anotado que salió y no se entregó."
        textoBoton="No se entregó"
        enviando={enviando}
        error={error}
        onCancelar={() => setAbierto(false)}
        onGuardar={(motivo) => empezar(async () => {
          const r = await registrarNoEntrega(pedidoId, motivo);
          if (!r.ok) return setError(r.error ?? "No se pudo guardar.");
          setAbierto(false);
          router.push("/pedidos");
          router.refresh();
        })}
      />
    </>
  );
}
