import Link from "next/link";
import { BotonVolver } from "@/components/BotonVolver";
import { Cabecera } from "@/components/Cabecera";
import { casillaConfigurada } from "@/lib/empretienda-imap";
import { exigirOficina } from "@/lib/session";
import { CONTENEDOR_PEDIDOS } from "../Encabezado";
import { Comparacion } from "./Comparacion";

// Comparación entre los mails de órdenes de Empretienda (casilla de Gmail, solo lectura) y los pedidos que cargó la planilla.
export default async function TiendaMails() {
  const usuario = await exigirOficina();
  const lista = casillaConfigurada();
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className={CONTENEDOR_PEDIDOS}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Lectura de los mails de la tienda</h1>
            <p className="mt-1 max-w-3xl text-sm text-stone-600">
              El sistema lee los mails “Tienes una nueva orden” de la etiqueta de Gmail (solo lectura: no marca ni borra nada) y los compara con los pedidos que ya cargó la planilla.
              <b> No crea ni cambia pedidos.</b> Cuando coincida varios días seguidos, se pasa a que los cree el sistema.
            </p>
          </div>
          <Link href="/pedidos?lista=web" className="text-sm font-semibold text-verde-800 hover:underline">← Minoristas (web)</Link>
        </div>
        {lista ? <Comparacion /> : (
          <p className="rounded-xl border border-stone-300 bg-white p-5 text-sm text-stone-700">
            Todavía no está conectada la casilla. Faltan en Railway las variables <code>GMAIL_USUARIO</code>, <code>GMAIL_CLAVE_APP</code> y <code>GMAIL_ETIQUETA</code>.
          </p>
        )}
        <BotonVolver fallback="/pedidos?lista=web" />
      </main>
    </>
  );
}
