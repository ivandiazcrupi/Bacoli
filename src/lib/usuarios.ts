// Reglas de usuarios y contraseñas (decisión del dueño: usuario corto para entrar; contraseña de 4 caracteres o más).
export const MIN_CLAVE = 4;
export const USUARIO_VALIDO = /^[a-z0-9._-]{2,30}$/;

// El email es opcional. Si una persona no tiene, se guarda uno interno (así no hay que alterar la tabla) que no se muestra.
const DOMINIO_INTERNO = "@sin-email.local";
export const emailSinCargar = (usuario: string) => `${usuario}${DOMINIO_INTERNO}`;
export const esEmailSinCargar = (email: string) => email.endsWith(DOMINIO_INTERNO);
