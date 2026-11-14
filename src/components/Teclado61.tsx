import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as RPointerEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cifraNota, ehPreta, nomeNota, soltarNota, tocarNota } from '../lib/audio'
import type { DedoInfo } from '../lib/types'

/**
 * Teclado de 61 teclas (C2–C7) do Casio CT-S300 em 2D.
 * API pensada para ser trocada pelo modelo 3D na Etapa 3 sem mudar quem usa:
 *  - highlight: teclas (MIDI) destacadas
 *  - fingers: mapa MIDI -> { dedo, mao } (mostra o número do dedo na tecla)
 *  - onNote(midi, ligado): chamado ao apertar (true) e soltar (false)
 */
export interface Teclado61Props {
  highlight?: number[]
  fingers?: Record<string, DedoInfo>
  onNote?: (midi: number, ligado: boolean) => void
  /** Teclas já acertadas (ficam verdes) */
  acertos?: number[]
  /** 'destacadas' (padrão) mostra nomes nas teclas destacadas e nos Dós; 'todas' em todas. */
  nomes?: 'destacadas' | 'todas'
  /** Nota que deve ficar visível ao abrir (padrão: centro das destacadas ou Dó central). */
  foco?: number
  som?: boolean
  min?: number
  max?: number
}

const LARG_BRANCA = 40
const ALT = 168

export default function Teclado61({
  highlight = [],
  fingers = {},
  onNote,
  acertos = [],
  nomes = 'destacadas',
  foco,
  som = true,
  min = 36,
  max = 96,
}: Teclado61Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [ativas, setAtivas] = useState<Set<number>>(new Set())
  const ponteiros = useRef(new Map<number, number>())
  const [janela, setJanela] = useState({ inicio: 0, largura: 1 })

  const { brancas, pretas } = useMemo(() => {
    const brancas: number[] = []
    const pretas: { midi: number; esquerda: number }[] = []
    for (let n = min; n <= max; n++) {
      if (ehPreta(n)) pretas.push({ midi: n, esquerda: brancas.length * LARG_BRANCA })
      else brancas.push(n)
    }
    return { brancas, pretas }
  }, [min, max])

  const larguraTotal = brancas.length * LARG_BRANCA
  const setHighlight = useMemo(() => new Set(highlight), [highlight])
  const setAcertos = useMemo(() => new Set(acertos), [acertos])

  const xDaNota = useCallback(
    (midi: number) => {
      let i = 0
      for (let n = min; n < midi; n++) if (!ehPreta(n)) i++
      return i * LARG_BRANCA
    },
    [min],
  )

  const atualizarJanela = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setJanela({ inicio: el.scrollLeft / larguraTotal, largura: Math.min(1, el.clientWidth / larguraTotal) })
  }, [larguraTotal])

  // Rola até a área de interesse ao abrir/mudar as teclas destacadas.
  const chaveFoco = foco ?? (highlight.length ? Math.round((Math.min(...highlight) + Math.max(...highlight)) / 2) : 60)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const alvo = xDaNota(chaveFoco) + LARG_BRANCA / 2 - el.clientWidth / 2
    el.scrollTo({ left: Math.max(0, alvo), behavior: 'auto' })
    atualizarJanela()
  }, [chaveFoco, xDaNota, atualizarJanela])

  useEffect(() => {
    window.addEventListener('resize', atualizarJanela)
    return () => window.removeEventListener('resize', atualizarJanela)
  }, [atualizarJanela])

  const ligar = useCallback(
    (midi: number) => {
      if (som) tocarNota(midi)
      setAtivas((s) => new Set(s).add(midi))
      onNote?.(midi, true)
    },
    [som, onNote],
  )
  const desligar = useCallback(
    (midi: number) => {
      if (som) soltarNota(midi)
      setAtivas((s) => {
        const n = new Set(s)
        n.delete(midi)
        return n
      })
      onNote?.(midi, false)
    },
    [som, onNote],
  )

  const notaDoPonto = (x: number, y: number): number | undefined => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    const v = el?.closest<HTMLElement>('[data-midi]')?.dataset.midi
    return v ? Number(v) : undefined
  }

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    const midi = notaDoPonto(e.clientX, e.clientY)
    if (midi === undefined) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* ignora */
    }
    ponteiros.current.set(e.pointerId, midi)
    ligar(midi)
  }
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const atual = ponteiros.current.get(e.pointerId)
    if (atual === undefined) return
    const midi = notaDoPonto(e.clientX, e.clientY)
    if (midi !== undefined && midi !== atual) {
      desligar(atual)
      ponteiros.current.set(e.pointerId, midi)
      ligar(midi)
    }
  }
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    const atual = ponteiros.current.get(e.pointerId)
    if (atual === undefined) return
    ponteiros.current.delete(e.pointerId)
    desligar(atual)
  }

  const rolar = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  const irPara = (fracao: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: fracao * larguraTotal - el.clientWidth / 2, behavior: 'smooth' })
  }

  const rotulo = (midi: number) => nomes === 'todas' || setHighlight.has(midi) || ativas.has(midi)

  const corDedo = (d?: DedoInfo) =>
    d?.mao === 'esquerda' ? 'bg-sky-400 text-slate-950' : 'bg-amber-400 text-slate-950'

  return (
    <div className="select-none" aria-label="Teclado de 61 teclas do Casio CT-S300">
      {/* Mapa do teclado inteiro: toque para ir até a região */}
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => rolar(-LARG_BRANCA * 7)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-slate-200 active:scale-95"
          aria-label="Oitava anterior"
        >
          <ChevronLeft size={20} />
        </button>
        <div
          className="relative h-7 flex-1 cursor-pointer overflow-hidden rounded-md bg-slate-200"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            irPara((e.clientX - r.left) / r.width)
          }}
          role="slider"
          aria-label="Região do teclado"
          aria-valuenow={Math.round(janela.inicio * 100)}
        >
          <div className="absolute inset-0 flex">
            {brancas.map((n) => (
              <div key={n} className={`flex-1 border-r border-slate-400/60 ${setHighlight.has(n) ? 'bg-amber-300' : ''}`} />
            ))}
          </div>
          {pretas.map((p) => (
            <div
              key={p.midi}
              className={`absolute top-0 h-[60%] ${setHighlight.has(p.midi) ? 'bg-amber-500' : 'bg-slate-900'}`}
              style={{ left: `${((p.esquerda - LARG_BRANCA * 0.3) / larguraTotal) * 100}%`, width: `${(LARG_BRANCA * 0.6 / larguraTotal) * 100}%` }}
            />
          ))}
          <div
            className="pointer-events-none absolute inset-y-0 rounded-sm border-2 border-amber-400 bg-amber-400/15"
            style={{ left: `${janela.inicio * 100}%`, width: `${janela.largura * 100}%` }}
          />
        </div>
        <button
          type="button"
          onClick={() => rolar(LARG_BRANCA * 7)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 text-slate-200 active:scale-95"
          aria-label="Próxima oitava"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={atualizarJanela}
        className="teclado-scroll overflow-x-auto rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-800 to-zinc-950 p-2 pt-3 shadow-2xl"
      >
        <div
          className="relative touch-none"
          style={{ width: larguraTotal, height: ALT }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          {brancas.map((n, i) => {
            const ativa = ativas.has(n)
            const hl = setHighlight.has(n)
            const ok = setAcertos.has(n)
            const dedo = fingers[String(n)]
            return (
              <div
                key={n}
                data-midi={n}
                className={`absolute top-0 flex flex-col items-center justify-end rounded-b-lg border border-zinc-400 pb-2 transition-colors duration-75 ${
                  ativa
                    ? 'bg-amber-200'
                    : ok
                      ? 'bg-emerald-200'
                      : hl
                        ? 'bg-amber-50 shadow-[inset_0_-6px_0_0_rgba(245,165,36,0.85)]'
                        : 'bg-gradient-to-b from-white to-zinc-100'
                }`}
                style={{ left: i * LARG_BRANCA, width: LARG_BRANCA, height: ALT }}
              >
                {dedo && (
                  <span className={`mb-1 grid h-6 w-6 place-items-center rounded-full text-xs font-black ${corDedo(dedo)}`}>
                    {dedo.dedo}
                  </span>
                )}
                {rotulo(n) && <span className="text-[11px] font-bold leading-none text-slate-800">{nomeNota(n)}</span>}
                {n % 12 === 0 && <span className="mt-0.5 text-[9px] leading-none text-slate-500">{cifraNota(n)}</span>}
              </div>
            )
          })}
          {pretas.map(({ midi, esquerda }) => {
            const ativa = ativas.has(midi)
            const hl = setHighlight.has(midi)
            const ok = setAcertos.has(midi)
            const dedo = fingers[String(midi)]
            const w = LARG_BRANCA * 0.62
            return (
              <div
                key={midi}
                data-midi={midi}
                className={`absolute top-0 z-10 flex flex-col items-center justify-end rounded-b-md pb-1.5 transition-colors duration-75 ${
                  ativa
                    ? 'bg-amber-500'
                    : ok
                      ? 'bg-emerald-600'
                      : hl
                        ? 'bg-gradient-to-b from-amber-700 to-amber-900 ring-2 ring-amber-400'
                        : 'bg-gradient-to-b from-zinc-700 to-black'
                }`}
                style={{ left: esquerda - w / 2, width: w, height: ALT * 0.62 }}
              >
                {dedo && (
                  <span className={`mb-1 grid h-5 w-5 place-items-center rounded-full text-[10px] font-black ${corDedo(dedo)}`}>
                    {dedo.dedo}
                  </span>
                )}
                {rotulo(midi) && <span className="text-[9px] font-bold leading-none text-white">{nomeNota(midi)}</span>}
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-amber-400" /> Mão direita
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-sky-400" /> Mão esquerda
        </span>
        <span>Toque na faixa acima ou use as setas para ver outras regiões.</span>
      </div>
    </div>
  )
}
