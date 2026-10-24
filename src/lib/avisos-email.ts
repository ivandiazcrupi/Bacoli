
/**
 * Aviso por email a UN cliente de la tienda online ("tu pedido llegará el martes 24 entre las 9 a 18 hs").
 * El mail está armado en un solo lugar (Pedidos → Minoristas (web) → Email al cliente): se cambia el día, el horario y el texto.
 * Se manda a mano: el sistema arma el mail y la persona lo copia y lo envía desde Gmail.
 */

export const TEXTO_AVISO = "Hola, {nombre}. ¿Cómo estás?\n\nTu pedido llegará el día {dia} entre las {horario}.\n\nEn caso de un problema, duda o lo que sea, escribinos al 1133555353.\n\nSaludos.";
export const ASUNTO_AVISO = "BACOLI · Tu entrega es el {dia} (#{orden})";
export const HORARIO_AVISO = "9 a 18 hs";

const primeraMayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();

export function armarAviso(plantilla: string | null, d: { nombre: string; dia: string; horario: string; orden?: string; asunto?: string | null }) {
  const llenar = (t: string) => t.replace(/\{nombre\}/g, primeraMayus(d.nombre)).replace(/\{dia\}/g, d.dia).replace(/\{horario\}/g, d.horario).replace(/\{orden\}/g, d.orden ?? "");
  return { asunto: llenar(d.asunto?.trim() || ASUNTO_AVISO).replace(/\s+/g, " ").trim(), texto: llenar(plantilla?.trim() || TEXTO_AVISO) };
}
