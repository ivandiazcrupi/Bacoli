import type { Rol } from "@prisma/client";

export const NOMBRE_ROL: Record<Rol, string> = {
  DUENO: "Dueño",
  ADMINISTRACION: "Administración",
  VENDEDOR: "Vendedor",
  REPARTIDOR: "Repartidor",
};

// Oficina (dueños y administración) ve todo. El vendedor solo ve sus clientes y sus pedidos (pantallas /vendedor).
// El repartidor solo verá su ruta.
export function esPersonalDeOficina(rol: Rol) {
  return rol === "DUENO" || rol === "ADMINISTRACION";
}

export function esVendedor(rol: Rol) {
  return rol === "VENDEDOR";
}

export function puedeGestionarUsuarios(rol: Rol) {
  return rol === "DUENO";
}
