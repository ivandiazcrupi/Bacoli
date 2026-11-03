import { vendedoresDesbloqueado } from "@/lib/claveVendedores";
import { asistenteDisponible } from "@/lib/asistente/asistente";
import { esPersonalDeOficina } from "@/lib/roles";
import { leerSesion } from "@/lib/session";
import { Asistente } from "./Asistente";

// Muestra el botón "Preguntar" solo si el asistente está activado (hay ANTHROPIC_API_KEY) y la persona es de oficina.
export async function AsistenteMontaje() {
  if (!asistenteDisponible()) return null;
  const sesion = await leerSesion();
  if (!sesion || !esPersonalDeOficina(sesion.rol)) return null;
  return <Asistente bloqueadoInicial={!(await vendedoresDesbloqueado())} />;
}
