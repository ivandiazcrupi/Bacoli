import "server-only";
import nodemailer from "nodemailer";

/**
 * Aviso por email a UN cliente de la tienda online ("tu pedido llegará el martes 24 entre las 9 a 18 hs").
 * El mail está armado en un solo lugar (Pedidos → Minoristas (web) → Email al cliente): se cambia el día, el horario y el texto.
 * Sale de la casilla de envío de BACOLI (Gmail, clave de aplicación en Railway: GMAIL_ENVIO_USUARIO y GMAIL_ENVIO_CLAVE_APP).
 */

export const TEXTO_AVISO = "Hola, {nombre}. ¿Cómo estás?\n\nTu pedido llegará el día {dia} entre las {horario}.\n\nEn caso de un problema, duda o lo que sea, escribinos al 1133555353.\n\nSaludos.";
export const ASUNTO_AVISO = "BACOLI · Tu entrega es el {dia} (#{orden})";
export const HORARIO_AVISO = "9 a 18 hs";

export const envioConfigurado = () => !!(process.env.GMAIL_ENVIO_USUARIO && process.env.GMAIL_ENVIO_CLAVE_APP);

const primeraMayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();

export function armarAviso(plantilla: string | null, d: { nombre: string; dia: string; horario: string; orden?: string; asunto?: string | null }) {
  const llenar = (t: string) => t.replace(/\{nombre\}/g, primeraMayus(d.nombre)).replace(/\{dia\}/g, d.dia).replace(/\{horario\}/g, d.horario).replace(/\{orden\}/g, d.orden ?? "");
  return { asunto: llenar(d.asunto?.trim() || ASUNTO_AVISO).replace(/\s+/g, " ").trim(), texto: llenar(plantilla?.trim() || TEXTO_AVISO) };
}

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function crearEnvio() {
  const user = process.env.GMAIL_ENVIO_USUARIO!;
  const pass = (process.env.GMAIL_ENVIO_CLAVE_APP ?? "").replace(/\s+/g, "");
  const transporte = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass }, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 });
  return async (para: string, asunto: string, texto: string, responderA?: string | null) => {
    await transporte.sendMail({
      from: `BACOLI <${user}>`,
      to: para,
      ...(responderA ? { replyTo: responderA } : {}),
      subject: asunto,
      text: texto,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#222">${escapar(texto).replace(/\n/g, "<br>")}</div>`,
    });
  };
}
