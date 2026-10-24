import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { htmlATexto, leerMailOrden, type OrdenDeMail } from "@/lib/empretienda-mail";

/**
 * Lectura de los mails de órdenes de Empretienda desde la casilla de Gmail, por IMAP y en SOLO LECTURA (no marca leídos ni borra nada).
 * Mira únicamente la etiqueta indicada en GMAIL_ETIQUETA. Las claves van en variables de entorno (GMAIL_USUARIO, GMAIL_CLAVE_APP); nunca en el código.
 */

export type LecturaMails = {
  ok: boolean;
  mensaje: string;
  ordenes: OrdenDeMail[];
  leidos: number; // mails que se revisaron
  ilegibles: { asunto: string; fecha: string; texto: string }[]; // mails de la etiqueta de los que no se pudo sacar una orden
};

export const casillaConfigurada = () => !!(process.env.GMAIL_USUARIO && process.env.GMAIL_CLAVE_APP && process.env.GMAIL_ETIQUETA);

const vacio = (mensaje: string): LecturaMails => ({ ok: false, mensaje, ordenes: [], leidos: 0, ilegibles: [] });

/** Lee los últimos `dias` días (hasta `maximo` mails) de la etiqueta y devuelve las órdenes que pudo interpretar. */
export async function leerOrdenesDeGmail(dias = 30, maximo = 400): Promise<LecturaMails> {
  const user = process.env.GMAIL_USUARIO;
  const pass = (process.env.GMAIL_CLAVE_APP ?? "").replace(/\s+/g, "");
  const etiqueta = process.env.GMAIL_ETIQUETA;
  if (!user || !pass || !etiqueta) return vacio("Falta cargar en Railway las variables GMAIL_USUARIO, GMAIL_CLAVE_APP y GMAIL_ETIQUETA.");

  const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user, pass }, logger: false, greetingTimeout: 20_000, socketTimeout: 90_000 });
  client.on("error", () => {}); // los errores de conexión se ven en el catch de abajo
  const ordenes = new Map<string, OrdenDeMail>();
  const ilegibles: LecturaMails["ilegibles"] = [];
  let leidos = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock(etiqueta, { readOnly: true });
    try {
      const desde = new Date(Date.now() - dias * 86_400_000);
      const uids = (await client.search({ since: desde }, { uid: true })) || [];
      const ultimos = uids.slice(-maximo);
      if (ultimos.length) {
        for await (const msg of client.fetch(ultimos, { uid: true, source: true, envelope: true }, { uid: true })) {
          leidos++;
          if (!msg.source) continue;
          const mail = await simpleParser(msg.source);
          if (/caducad/i.test(mail.subject ?? "")) continue; // "La orden #N ha caducado": no es un pedido
          const html = typeof mail.html === "string" ? mail.html : "";
          const texto = html ? htmlATexto(html) : (mail.text ?? "");
          const orden = leerMailOrden(texto) ?? (mail.text ? leerMailOrden(mail.text) : null);
          if (orden) ordenes.set(orden.orden, orden); // si una orden llegó dos veces, queda la última
          else ilegibles.push({ asunto: mail.subject ?? "(sin asunto)", fecha: mail.date ? mail.date.toISOString() : "", texto: texto.slice(0, 400) });
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (e) {
    try { client.close(); } catch { /* ya estaba cerrada */ }
    const err = e as { authenticationFailed?: boolean; responseText?: string; code?: string; message?: string };
    if (err.authenticationFailed) return vacio("Gmail rechazó el usuario o la clave. Revisá GMAIL_USUARIO y GMAIL_CLAVE_APP (la clave de aplicación va sin espacios).");
    if (/mailbox|doesn.?t exist|nonexistent|trycreate/i.test(`${err.responseText ?? ""} ${err.message ?? ""}`)) return vacio(`Gmail no encuentra la etiqueta “${etiqueta}”. Tiene que llamarse exactamente igual en GMAIL_ETIQUETA.`);
    return vacio(`No se pudo leer la casilla de Gmail (${err.code ?? err.message ?? "error de conexión"}). Probá de nuevo en unos minutos.`);
  }
  return {
    ok: true,
    mensaje: `Se revisaron ${leidos} ${leidos === 1 ? "mail" : "mails"} de la etiqueta y se entendieron ${ordenes.size} ${ordenes.size === 1 ? "orden" : "órdenes"}.`,
    ordenes: [...ordenes.values()].sort((a, b) => Number(a.orden) - Number(b.orden)),
    leidos,
    ilegibles,
  };
}
