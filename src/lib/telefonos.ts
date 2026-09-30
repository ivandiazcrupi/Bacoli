/**
 * Enlace de WhatsApp para un teléfono argentino escrito de cualquier forma ("11 5555-0000", "011 15 5555 0000",
 * "+54 9 11 5555 0000"). Devuelve null si no se puede armar un número válido, y en ese caso no se muestra el botón.
 */
export function enlaceWhatsApp(telefono: string | null | undefined): string | null {
  if (!telefono) return null;
  let d = telefono.replace(/\D/g, "");
  if (d.startsWith("54")) {
    d = d.replace(/^54(9?)/, "");
  } else {
    d = d.replace(/^0+/, "");
  }
  // Se saca el "15" de celular que va después del código de área (2, 3 o 4 dígitos).
  if (d.length === 12) {
    for (const area of [2, 3, 4]) {
      if (d.slice(area, area + 2) === "15") { d = d.slice(0, area) + d.slice(area + 2); break; }
    }
  }
  if (d.length !== 10) return null; // código de área + número, sin ceros ni 15
  return `https://wa.me/549${d}`;
}
