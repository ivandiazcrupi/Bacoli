import { Listado } from "./Listado";

export default async function Facturas({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; pagina?: string }> }) {
  return <Listado tipo="FACTURA" ruta="/cuentas" searchParams={await searchParams} />;
}
