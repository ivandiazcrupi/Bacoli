import { Listado } from "./Listado";

// FACTURAS: mismo listado que REMITOS, pero con las facturas y notas de crédito que emitió ARCA.
export default async function Facturas({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; pagina?: string }> }) {
  return <Listado tipo="FACTURA" ruta="/cuentas" searchParams={await searchParams} />;
}
