import { Cabecera } from "@/components/Cabecera";
import { exigirUsuario } from "@/lib/session";
import { esEmailSinCargar } from "@/lib/usuarios";
import { FormularioClave, FormularioUsuario } from "./FormularioClave";

export default async function Cuenta() {
  const usuario = await exigirUsuario();
  return (
    <>
      <Cabecera usuario={usuario} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <h1 className="text-2xl font-bold">Mi cuenta</h1>
        <p className="text-stone-600">{usuario.nombre}{!esEmailSinCargar(usuario.email) && ` · ${usuario.email}`}</p>
        <div className="grid items-start gap-4 md:grid-cols-2">
          <FormularioUsuario usuario={usuario.usuario} />
          <FormularioClave />
        </div>
      </main>
    </>
  );
}
