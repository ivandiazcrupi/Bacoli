import { PestanasSeccion } from "@/components/PestanasSeccion";

// Título de PRODUCCIÓN y solapas. El control (números, horas, semana) lo ve solo la oficina.
export function EncabezadoProduccion({ activa, oficina }: { activa: "cargar" | "control"; oficina: boolean }) {
  const items = [{ id: "cargar" as const, texto: "Cargar", href: "/produccion" }, ...(oficina ? [{ id: "control" as const, texto: "Control", href: "/produccion/control" }] : [])];
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Producción</h1>
      {oficina && <PestanasSeccion items={items} activa={activa} etiqueta="Producción" />}
    </>
  );
}
