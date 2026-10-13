// LEADS: posibles clientes que todavía no pidieron. Estados, orígenes y tipos de contacto del mini CRM.
export const ESTADOS = [
  ["NUEVO", "Nuevo", "Entró y todavía no se le escribió."],
  ["CONTACTADO", "Contactado", "Ya se le escribió o se lo llamó."],
  ["MUESTRA", "Muestra", "Se le mandó o se le llevó una muestra."],
  ["NEGOCIANDO", "Negociando", "Está viendo precios o condiciones."],
  ["GANADO", "Ganado", "Pasó a ser cliente."],
  ["PERDIDO", "Perdido", "No va a comprar (queda anotado por qué)."],
] as const;
export type EstadoLead = (typeof ESTADOS)[number][0];
export const nombreEstado = (e: string) => ESTADOS.find(([k]) => k === e)?.[1] ?? e;
export const estadoValido = (e: string): e is EstadoLead => ESTADOS.some(([k]) => k === e);
export const ABIERTOS: EstadoLead[] = ["NUEVO", "CONTACTADO", "MUESTRA", "NEGOCIANDO"]; // los que todavía hay que seguir

export const ORIGENES = ["WhatsApp", "Instagram", "Referido", "Web", "Llamada", "Visita", "Otro"];

// Tipos de anotación del historial. "ESTADO" lo anota el sistema solo cuando cambia el estado.
export const TIPOS_CONTACTO = [
  ["WHATSAPP", "Le escribí por WhatsApp"],
  ["LLAMADA", "Lo llamé"],
  ["RESPUESTA", "Me respondió / me escribió"],
  ["VISITA", "Lo visité"],
  ["MUESTRA", "Le mandé una muestra"],
  ["NOTA", "Nota"],
] as const;
export const nombreTipo = (t: string) => (t === "ESTADO" ? "Cambio de estado" : TIPOS_CONTACTO.find(([k]) => k === t)?.[1] ?? t);
