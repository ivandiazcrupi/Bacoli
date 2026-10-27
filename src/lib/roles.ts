import type { Rol } from "@prisma/client";

export const NOMBRE_ROL: Record<Rol, string> = {
  DUENO: "Gerente",
  ADMINISTRACION: "Administración",
  VENDEDOR: "Vendedor",
  REPARTIDOR: "Repartidor",
  PRODUCCION: "Producción",
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

/** Producción (Gastón, Federico): solo cargan la producción desde el celular. La oficina también la ve y puede cargar. */
export function esProduccion(rol: Rol) {
  return rol === "PRODUCCION";
}

export function puedeVerProduccion(rol: Rol) {
  return esPersonalDeOficina(rol) || esProduccion(rol);
}
