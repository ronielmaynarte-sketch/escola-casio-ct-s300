import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, Timer } from 'lucide-react'
import type { Tempos } from '../lib/types'
import { formatarRelogio } from '../lib/curso'
import { useProgresso } from '../lib/ProgressContext'

const FASES: { chave: keyof Tempos; nome: string }[] = [
  { chave: 'explicacao', nome: 'Explicação' },
  { chave: 'observacao', nome: 'Observação' },
  { chave: 'pratica', nome: 'Prática' },
  { chave: 'exercicio', nome: 'Exercício' },
]

/**
 * Cronômetro de estudo por fase. Registra o tempo real estudado.
 * É só um guia: não bloqueia a conclusão da aula.
 */
export default function Cronometro({ aulaId, tempos }: { aulaId: string; tempos: Tempos }) {
  const { registrarTempo } = useProgresso()
  const [fase, setFase] = useState<keyof Tempos>('explicacao')
  const [rodando, setRodando] = useState(false)
  const [porFase, setPorFase] = useState<Record<keyof Tempos, number>>({ explicacao: 0, observacao: 0, pratica: 0, exercicio: 0 })
  const pendente = useRef(0)
  const faseRef = useRef(fase)
  faseRef.current = fase

  const salvar = useCallback(() => {
    if (pendente.current > 0) {
      registrarTempo(aulaId, pendente.current)
      pendente.current = 0
    }
  }, [aulaId, registrarTempo])

  useEffect(() => {
    if (!rodando) return
    const id = window.setInterval(() => {
      setPorFase((p) => ({ ...p, [faseRef.current]: p[faseRef.current] + 1 }))
      pendente.current += 1
      if (pendente.current >= 15) salvar()
    }, 1000)
    return () => window.clearInterval(id)
  }, [rodando, salvar])

  // Salva ao sair da página ou esconder o app.
  const salvarRef = useRef(salvar)
  salvarRef.current = salvar
  useEffect(() => {
    const vis = () => {
      if (document.visibilityState === 'hidden') salvarRef.current()
    }
    document.addEventListener('visibilitychange', vis)
    return () => {
      document.removeEventListener('visibilitychange', vis)
      salvarRef.current()
    }
  }, [])

  const alternar = () => {
    if (rodando) salvar()
    setRodando(!rodando)
  }

  const total = Object.values(porFase).reduce((a, b) => a + b, 0)
  const recomendadoTotal = FASES.reduce((a, f) => a + tempos[f.chave], 0)

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Timer size={18} className="text-amber-400" /> Cronômetro de estudo
        </div>
        <span className="text-xs text-slate-400">Sugerido: {recomendadoTotal} min</span>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {FASES.map((f) => {
          const sel = f.chave === fase
          const feito = porFase[f.chave] >= tempos[f.chave] * 60
          return (
            <button
              key={f.chave}
              type="button"
              onClick={() => setFase(f.chave)}
              className={`rounded-xl px-1 py-2 text-center transition ${
                sel ? 'bg-amber-400 text-slate-950' : 'bg-white/5 text-slate-300 active:bg-white/10'
              }`}
            >
              <div className="text-[11px] font-semibold leading-tight">{f.nome}</div>
              <div className={`text-[10px] ${sel ? 'text-slate-800' : feito ? 'text-emerald-400' : 'text-slate-500'}`}>
                {formatarRelogio(porFase[f.chave])} / {tempos[f.chave]}min
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1">
          <div className="font-mono text-4xl font-bold tabular-nums text-white">{formatarRelogio(porFase[fase])}</div>
          <div className="text-xs text-slate-400">Total nesta visita: {formatarRelogio(total)}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            salvar()
            setRodando(false)
            setPorFase((p) => ({ ...p, [fase]: 0 }))
          }}
          className="grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-slate-300 active:scale-95"
          aria-label="Zerar fase"
        >
          <RotateCcw size={20} />
        </button>
        <button
          type="button"
          onClick={alternar}
          className={`flex h-14 items-center gap-2 rounded-2xl px-5 font-bold active:scale-95 ${
            rodando ? 'bg-white/10 text-white' : 'bg-amber-400 text-slate-950'
          }`}
        >
          {rodando ? <Pause size={20} /> : <Play size={20} />}
          {rodando ? 'Pausar' : 'Iniciar'}
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        O cronômetro é só um guia e registra seu tempo real de estudo. Você pode concluir a aula quando se sentir pronto.
      </p>
    </div>
  )
}
