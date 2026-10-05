import Link from "next/link";

/** Nombre del cliente: si es un cliente cargado, es un enlace a su historial de pedidos (los de la tienda online no tienen). */
export function NombreCliente({ clienteId, nombre }: { clienteId: string | null; nombre: string }) {
  if (!clienteId) return <>{nombre}</>;
  return <Link href={`/clientes/${clienteId}/pedidos`} title="Ver los pedidos de este cliente" className="underline-offset-4 hover:underline">{nombre}</Link>;
}
