import { Listado } from "../Listado";

export default async function Remitos({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; pagina?: string }> }) {
  return <Listado tipo="REMITO" ruta="/cuentas/remitos" searchParams={await searchParams} />;
}
