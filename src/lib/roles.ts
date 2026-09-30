import type { Rol } from "@prisma/client";

export const NOMBRE_ROL: Record<Rol, string> = {
  DUENO: "Dueño",
  ADMINISTRACION: "Administración",
  VENDEDOR: "Vendedor",
  REPARTIDOR: "Repartidor",
};

// Por ahora, todo el equipo de oficina ve todo. El repartidor solo verá su ruta.
// Cuando se quiera restringir algo, se cambia acá.
export function esPersonalDeOficina(rol: Rol) {
  return rol !== "REPARTIDOR";
}

export function puedeGestionarUsuarios(rol: Rol) {
  return rol === "DUENO";
}
