import "server-only";
import nodemailer from "nodemailer";
import { nombreDia, diaMes } from "@/lib/fechas";

/**
 * Aviso por email a los clientes de la tienda online: "tu pedido llega el martes 27/10 entre las 14 y las 18 hs".
 * Sale de la casilla de envío de BACOLI (Gmail, clave de aplicación en variables de Railway: GMAIL_ENVIO_USUARIO y GMAIL_ENVIO_CLAVE_APP).
 */

export const TEXTO_AVISO = "Hola {nombre}, ¡gracias por tu compra en BACOLI! Tu pedido #{orden} llega el {dia}, {horario}.\n\nSi necesitás cambiar algo, respondé este mail.";

export const envioConfigurado = () => !!(process.env.GMAIL_ENVIO_USUARIO && process.env.GMAIL_ENVIO_CLAVE_APP);

/** "martes 27/10" */
export const diaLargo = (fecha: string) => `${nombreDia(fecha).toLowerCase()} ${diaMes(fecha)}`;

const primeraMayus = (t: string) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();

export function armarAviso(plantilla: string | null, d: { nombre: string; orden: string; fecha: string; horario: string }) {
  const llenar = (t: string) => t.replace(/\{nombre\}/g, primeraMayus(d.nombre)).replace(/\{orden\}/g, d.orden).replace(/\{dia\}/g, diaLargo(d.fecha)).replace(/\{horario\}/g, d.horario);
  return { asunto: `Tu pedido #${d.orden} de BACOLI llega el ${diaLargo(d.fecha)}`, texto: llenar(plantilla?.trim() || TEXTO_AVISO) };
}

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function crearEnvio() {
  const user = process.env.GMAIL_ENVIO_USUARIO!;
  const pass = (process.env.GMAIL_ENVIO_CLAVE_APP ?? "").replace(/\s+/g, "");
  const transporte = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
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
