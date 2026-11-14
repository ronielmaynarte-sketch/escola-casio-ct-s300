import { nome } from '../lib/musica/notas'
import type { EstiloNome } from '../lib/musica/notas'
import type { Passo } from '../lib/musica/tipos'

/** Faixa com o passo atual e os próximos (antes de tocar, o aluno vê o que vem). */
export default function FaixaNotas({
  atual,
  proximos,
  ocultarDicas,
  estiloNome,
  pressionadasCertas = [],
}: {
  atual?: Passo
  proximos: Passo[]
  ocultarDicas: boolean
  estiloNome: EstiloNome
  pressionadasCertas?: number[]
}) {
  const chip = (p: Passo, principal: boolean, i: number) => {
    const notas = [...p.notas].sort((a, b) => b.midi - a.midi)
    return (
      <div
        key={`${p.t}-${i}`}
        data-testid={principal ? 'passo-atual' : undefined}
        className={`flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-1 ${
          principal ? 'min-w-[64px] border-amber-400 bg-amber-400/15' : 'min-w-[44px] border-white/10 bg-white/[0.04] opacity-80'
        }`}
        style={{ minHeight: principal ? 52 : 40 }}
      >
        {ocultarDicas ? (
          <span className={`font-black text-slate-300 ${principal ? 'text-lg' : 'text-sm'}`}>{'?'.repeat(Math.min(3, notas.length))}</span>
        ) : (
          notas.map((n) => (
            <span
              key={n.midi}
              className={`rounded px-1 font-bold leading-tight ${principal ? 'text-[15px]' : 'text-[11px]'} ${
                pressionadasCertas.includes(n.midi) && principal ? 'bg-lime-400 text-slate-950' : n.mao === 'esquerda' ? 'text-emerald-300' : 'text-sky-300'
              }`}
            >
              {nome(n.midi, estiloNome)}
              {n.dedo ? <sup className="ml-0.5 text-[9px] text-slate-400">{n.dedo}</sup> : null}
            </span>
          ))
        )}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5 overflow-hidden" aria-label="Próximas notas">
      {atual && chip(atual, true, -1)}
      {proximos.map((p, i) => chip(p, false, i))}
      {!atual && <span className="text-sm text-slate-400">—</span>}
    </div>
  )
}
