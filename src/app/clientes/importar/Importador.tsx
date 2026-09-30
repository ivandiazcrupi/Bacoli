"use client";

import { useActionState } from "react";
import { Campo, Mensajes, estiloBoton, estiloCampo } from "@/components/campos";
import { MARCAS_INICIALES } from "@/lib/importar-clientes";
import { importar, previsualizar, type EstadoImport } from "./actions";

export function Importador({ zonas }: { zonas: string[] }) {
  const [vista, calcular, calculando] = useActionState(previsualizar, undefined as EstadoImport);
  const [resultado, aplicar, aplicando] = useActionState(importar, undefined as EstadoImport);
  const estado = resultado?.analisis ? resultado : vista;
  const a = estado?.analisis;
  const nuevos = a ? a.clientes.filter((c) => !estado!.existentes?.some((e) => e.toLowerCase() === c.nombre.toLowerCase())) : [];

  return (
    <form key={JSON.stringify([estado?.error, estado?.ok, a?.clientes.length])} className="space-y-4">
      <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4">
        <Campo etiqueta="Archivo CSV de clientes" ayuda="Se puede exportar desde Google Sheets: Archivo → Descargar → CSV.">
          <input type="file" name="archivo" accept=".csv,text/csv" className={estiloCampo} />
        </Campo>
        {estado?.csv && <textarea name="csv" defaultValue={estado.csv} hidden readOnly />}
        <Campo etiqueta="Marcas que se agrupan en un solo cliente" ayuda="Separadas por coma. Las franquicias con otro CUIT quedan como clientes aparte.">
          <input name="marcas" defaultValue={estado?.opciones?.marcas.join(", ") ?? MARCAS_INICIALES.join(", ")} className={estiloCampo} />
        </Campo>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="separarMismoCuit" defaultChecked={estado?.opciones?.separarMismoCuit} className="mt-1 h-5 w-5" />
          <span>Separar los locales de una misma franquicia aunque tengan el mismo CUIT (cada uno sería un cliente).</span>
        </label>
        <Campo etiqueta="Clientes en estado Baja o Contactar">
          <select name="bajaYContactar" defaultValue={estado?.opciones?.bajaYContactar ?? "DESACTIVADOS"} className={estiloCampo}>
            <option value="DESACTIVADOS">Importarlos desactivados</option>
            <option value="NO_IMPORTAR">No importarlos</option>
          </select>
        </Campo>
        <button formAction={calcular} disabled={calculando} className={estiloBoton}>{calculando ? "Leyendo…" : a ? "Actualizar vista previa" : "Ver vista previa"}</button>
        {!a && <Mensajes estado={estado} />}
      </div>

      {a && (
        <>
          <section className="space-y-2 rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="font-semibold">Resumen (todavía no se cargó nada)</h2>
            <ul className="text-sm">
              <li><b>{nuevos.length}</b> clientes nuevos, con <b>{nuevos.reduce((n, c) => n + c.sucursales.length, 0)}</b> sucursales</li>
              <li>{nuevos.filter((c) => c.activo).length} activos y {nuevos.filter((c) => !c.activo).length} desactivados</li>
              {estado!.existentes && estado!.existentes.length > 0 && <li>{estado!.existentes.length} ya existen y no se tocan</li>}
              <li>{a.excluidos.length} no se importan · {a.avisos.length} avisos</li>
            </ul>
          </section>

          <section className="space-y-2 rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="font-semibold">Zona de reparto de cada barrio ({a.barrios.length})</h2>
            <p className="text-xs text-stone-500">Es una propuesta: corregí lo que no sea correcto. Los barrios sin propuesta hay que elegirlos.</p>
            <div className="divide-y divide-stone-100">
              {a.barrios.map((b) => (
                <label key={b.barrio} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>{b.titulo} <span className="text-stone-500">({b.filas})</span></span>
                  <select name={`zona_${b.barrio}`} defaultValue={estado!.zonaPorBarrio?.[b.barrio] ?? ""} className="rounded-lg border border-stone-300 bg-white px-2 py-2">
                    <option value="">— Elegir —</option>
                    {zonas.map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </section>

          <details className="rounded-lg border border-stone-200 bg-white p-4">
            <summary className="cursor-pointer font-semibold">Clientes que se van a crear ({nuevos.length})</summary>
            <ul className="mt-3 divide-y divide-stone-100 text-sm">
              {nuevos.map((c) => (
                <li key={c.nombre} className="py-2">
                  <p className="font-medium">{c.nombre}{!c.activo && <span className="font-normal text-stone-500"> · desactivado</span>}</p>
                  <p className="text-stone-600">
                    {c.tipo === "DISTRIBUIDOR" ? "Distribuidor" : "Mayorista"} · {c.sucursales.length} {c.sucursales.length === 1 ? "sucursal" : "sucursales"}
                    {c.marca && ` · marca ${c.marca}`}{c.cuit && ` · CUIT ${c.cuit}`}{c.comisionista && ` · comisión ${c.comisionPct}% (${c.comisionista})`}
                  </p>
                </li>
              ))}
            </ul>
          </details>

          {a.excluidos.length > 0 && (
            <details className="rounded-lg border border-stone-200 bg-white p-4">
              <summary className="cursor-pointer font-semibold">No se importan ({a.excluidos.length})</summary>
              <ul className="mt-3 space-y-2 text-sm">{a.excluidos.map((e, i) => <li key={i}><b>{e.nombre}</b>: {e.motivo}</li>)}</ul>
            </details>
          )}
          {a.avisos.length > 0 && (
            <details className="rounded-lg border border-stone-200 bg-white p-4">
              <summary className="cursor-pointer font-semibold">Avisos ({a.avisos.length})</summary>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{a.avisos.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </details>
          )}

          <div className="space-y-3 rounded-lg border-2 border-amber-700 bg-white p-4">
            <p className="text-sm">Al confirmar se cargan <b>{nuevos.length} clientes</b> en el sistema. Los que ya existen no se modifican.</p>
            <Mensajes estado={resultado ?? estado} />
            <button formAction={aplicar} disabled={aplicando || !!resultado?.ok || nuevos.length === 0} className={estiloBoton}>
              {aplicando ? "Importando…" : "Confirmar e importar"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
