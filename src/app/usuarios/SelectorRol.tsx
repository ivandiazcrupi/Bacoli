"use client";

import { cambiarRol } from "./actions";

const ROLES: { valor: string; texto: string }[] = [
  { valor: "DUENO", texto: "Dueño" },
  { valor: "ADMINISTRACION", texto: "Administración" },
  { valor: "VENDEDOR", texto: "Vendedor" },
  { valor: "REPARTIDOR", texto: "Repartidor" },
];

// Cambia el rol al elegirlo; pide confirmar porque cambia lo que la persona puede ver.
export function SelectorRol({ id, nombre, rol }: { id: string; nombre: string; rol: string }) {
  return (
    <form action={cambiarRol} className="text-sm">
      <input type="hidden" name="id" value={id} />
      <select
        name="rol"
        defaultValue={rol}
        aria-label={`Rol de ${nombre}`}
        className="h-9 rounded-md border border-stone-400 bg-white px-2 text-sm"
        onChange={(e) => {
          const nuevo = ROLES.find((r) => r.valor === e.currentTarget.value)?.texto;
          if (window.confirm(`¿Cambiar el rol de ${nombre} a ${nuevo}?`)) e.currentTarget.form?.requestSubmit();
          else e.currentTarget.value = rol;
        }}
      >
        {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.texto}</option>)}
      </select>
    </form>
  );
}
