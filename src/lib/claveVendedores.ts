import "server-only";
import { db } from "./db";
import { leerSesion } from "./session";

// Vendedores, Estadísticas, Tienda online, el total de la SEMANA y los montos del asistente son SOLO para GERENTES (rol DUENO).
// Ya no hay contraseña: se mira el rol de quien está logueado (leído de la base, así un cambio de rol vale enseguida).
// (La columna Empresa.claveVendedoresHash queda en la base sin uso: no se borró.)
export async function vendedoresDesbloqueado(): Promise<boolean> {
  const sesion = await leerSesion();
  if (!sesion) return false;
  const u = await db.usuario.findUnique({ where: { id: sesion.usuarioId }, select: { rol: true, activo: true } });
  return !!u && u.activo && u.rol === "DUENO";
}
