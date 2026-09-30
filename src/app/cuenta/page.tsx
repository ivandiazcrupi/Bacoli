import { Cabecera } from "@/components/Cabecera";
import { exigirUsuario } from "@/lib/session";
import { FormularioClave } from "./FormularioClave";

export default async function Cuenta() {
  const usuario = await exigirUsuario();
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <h1 className="text-2xl font-bold">Mi cuenta</h1>
        <p className="text-stone-600">{usuario.nombre} · {usuario.email}</p>
        <FormularioClave />
      </main>
    </>
  );
}
