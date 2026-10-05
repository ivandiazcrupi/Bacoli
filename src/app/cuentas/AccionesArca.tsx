import { SubirArchivo } from "./arca/SubirArchivo";

// Botón de arriba a la derecha de Facturas: subir el archivo de ARCA .
export function AccionesArca({ esDueno, cantidad }: { esDueno: boolean; cantidad: number }) {
  return (
    <details className="relative">
      <summary className="flex h-8 cursor-pointer list-none items-center rounded-md border border-stone-300 bg-white px-3 text-[13px] font-semibold text-stone-700 hover:border-stone-500">⬆ Subir archivo de ARCA</summary>
      <div className="absolute right-0 top-9 z-30 w-[420px] rounded-md border border-stone-300 bg-white p-4 text-sm shadow-lg">
        <p className="mb-2 text-stone-600">Libro IVA Ventas (VENTAS.txt) o el CSV de Mis Comprobantes → Emitidos. No duplica lo ya cargado.</p>
        <SubirArchivo />
      </div>
    </details>
  );
}
