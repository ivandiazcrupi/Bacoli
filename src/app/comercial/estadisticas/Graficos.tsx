// Gráficos simples hechos a mano (SVG/CSS), sin librerías. Se ven bien en PC y no pesan.

export const PALETA = ["#026433", "#3b6ea5", "#c08a1e", "#7a5aa6", "#8a8578", "#aa0e1d"];

/** Panel con título, para armar el tablero. */
export function Panel({ titulo, nota, children, className = "" }: { titulo: string; nota?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-stone-300 bg-white p-4 shadow-sm ${className}`}>
      <header className="mb-3 flex items-baseline justify-between gap-3 border-b border-stone-200 pb-2">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.12em] text-stone-600">{titulo}</h2>
        {nota && <span className="text-[11.5px] text-stone-400">{nota}</span>}
      </header>
      {children}
    </section>
  );
}

export function SinDatos({ texto = "Todavía no hay datos en este mes." }: { texto?: string }) {
  return <p className="py-10 text-center text-sm text-stone-400">{texto}</p>;
}

/** Barras verticales (una por día o por mes). `series` apila varias partes en cada barra. */
export function Barras({ etiquetas, series, formato = (n) => String(n), alto = 190, ancho: W = 720, resaltar, valoresSiempre = false }: {
  etiquetas: string[]; series: { nombre: string; color: string; valores: number[] }[]; formato?: (n: number) => string; alto?: number; ancho?: number; resaltar?: number; valoresSiempre?: boolean;
}) {
  const n = etiquetas.length;
  const totales = etiquetas.map((_, i) => series.reduce((t, s) => t + (s.valores[i] ?? 0), 0));
  const max = Math.max(...totales, 1);
  const H = alto, base = H - 24, techo = 18, paso = W / n, anchoBarra = Math.min(34, paso * 0.68);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
        {[0.5, 1].map((f) => <line key={f} x1="0" x2={W} y1={base - (base - techo) * f} y2={base - (base - techo) * f} stroke="#e7e5e4" strokeDasharray="3 4" />)}
        <line x1="0" x2={W} y1={base} y2={base} stroke="#a8a29e" />
        {etiquetas.map((e, i) => {
          let y = base;
          const x = i * paso + (paso - anchoBarra) / 2;
          return (
            <g key={i}>
              {series.map((s) => {
                const v = s.valores[i] ?? 0;
                const h = (v / max) * (base - techo);
                y -= h;
                return v > 0 ? <rect key={s.nombre} x={x} y={y} width={anchoBarra} height={h} rx="2" fill={s.color} opacity={resaltar === undefined || resaltar === i ? 1 : 0.55}><title>{`${e} · ${s.nombre}: ${formato(v)}`}</title></rect> : null;
              })}
              {totales[i] > 0 && (n <= 14 || valoresSiempre) && <text x={x + anchoBarra / 2} y={y - 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#44403c">{formato(totales[i])}</text>}
              {(n <= 14 || i % 2 === 0) && <text x={x + anchoBarra / 2} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#78716c">{e}</text>}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && <Leyenda items={series.map((s) => ({ nombre: s.nombre, color: s.color }))} />}
    </div>
  );
}

export function Leyenda({ items }: { items: { nombre: string; color: string; valor?: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-stone-600">
      {items.map((i) => <li key={i.nombre} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />{i.nombre}{i.valor && <b className="text-stone-800">{i.valor}</b>}</li>)}
    </ul>
  );
}

/** Torta con agujero (donut) y su lista al costado. */
export function Donut({ partes, centro }: { partes: { nombre: string; valor: number }[]; centro?: string }) {
  const total = partes.reduce((t, p) => t + p.valor, 0);
  if (total === 0) return <SinDatos />;
  const R = 52, r = 34, C = 2 * Math.PI * ((R + r) / 2);
  let acum = 0;
  return (
    <div className="flex flex-wrap items-center justify-center gap-5">
      <svg viewBox="0 0 140 140" className="h-36 w-36 shrink-0 -rotate-90" role="img">
        {partes.map((p, i) => {
          const largo = (p.valor / total) * C;
          const el = <circle key={p.nombre} cx="70" cy="70" r={(R + r) / 2} fill="none" stroke={PALETA[i % PALETA.length]} strokeWidth={R - r} strokeDasharray={`${largo} ${C - largo}`} strokeDashoffset={-acum}><title>{`${p.nombre}: ${p.valor}`}</title></circle>;
          acum += largo;
          return el;
        })}
        <g className="rotate-90" style={{ transformOrigin: "70px 70px" }}>
          <text x="70" y="68" textAnchor="middle" fontSize="22" fontWeight="800" fill="#1c1917">{total}</text>
          <text x="70" y="84" textAnchor="middle" fontSize="9.5" fill="#78716c">{centro ?? "pedidos"}</text>
        </g>
      </svg>
      <ul className="space-y-1.5 text-[13px]">
        {partes.map((p, i) => (
          <li key={p.nombre} className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: PALETA[i % PALETA.length] }} />
            <span className="text-stone-700">{p.nombre}</span><b className="tabular-nums text-stone-900">{p.valor}</b><span className="text-[11.5px] text-stone-400">{Math.round((p.valor / total) * 100)}%</span></li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontales (rankings). */
export function BarrasH({ filas, formato, color = "#026433" }: { filas: { nombre: string; valor: number; extra?: string }[]; formato: (n: number) => string; color?: string }) {
  const max = Math.max(...filas.map((f) => f.valor), 1);
  return (
    <ol className="space-y-1.5">
      {filas.map((f, i) => (
        <li key={f.nombre + i} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 text-[13px]">
          <span className="text-right text-[11.5px] font-bold tabular-nums text-stone-400">{i + 1}</span>
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-2"><span className="truncate font-semibold text-stone-800" title={f.nombre}>{f.nombre}</span>{f.extra && <span className="shrink-0 text-[11.5px] text-stone-400">{f.extra}</span>}</div>
            <div className="mt-0.5 h-2 rounded-full bg-stone-100"><div className="h-2 rounded-full" style={{ width: `${Math.max(2, (f.valor / max) * 100)}%`, background: color }} /></div>
          </div>
          <b className="min-w-[4.5rem] text-right tabular-nums text-stone-900">{formato(f.valor)}</b>
        </li>
      ))}
    </ol>
  );
}
