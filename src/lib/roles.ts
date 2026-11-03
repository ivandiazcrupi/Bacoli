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

/** El módulo Producción está APAGADO hasta que el dueño pida desarrollarlo (se prende con la variable HABILITAR_PRODUCCION=1). Nada se borró. */
export function produccionActiva() {
  return process.env.HABILITAR_PRODUCCION === "1";
}

export function puedeVerProduccion(rol: Rol) {
  return produccionActiva() && (esPersonalDeOficina(rol) || esProduccion(rol));
}
