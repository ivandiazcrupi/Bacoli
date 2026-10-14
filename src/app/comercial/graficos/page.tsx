import { redirect } from "next/navigation";

// El apartado se llama ahora Estadísticas: se conserva la dirección vieja por si quedó guardada.
export default async function Page({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  redirect(mes ? `/comercial/estadisticas?mes=${encodeURIComponent(mes)}` : "/comercial/estadisticas");
}
