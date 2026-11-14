import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as RPointerEvent } from 'react'
import { Minus, Plus, Maximize2 } from 'lucide-react'
import { soltarNota, tocarNota } from '../lib/audio'
import { ehPreta, nome, nomeComOitava } from '../lib/musica/notas'
import type { EstiloNome } from '../lib/musica/notas'
import type { NotaPasso } from '../lib/musica/tipos'

/**
 * Teclado completo do CT-S300 (61 teclas, Dó2–Dó7) para o professor:
 * próximas teclas acesas (azul = mão direita, verde = mão esquerda), dedos, erro em vermelho,
 * acerto piscando, teclas apertadas no teclado real aparecendo afundadas, marcador da divisão das mãos,
 * zoom/rolagem até a região ativa e mapa das 61 teclas.
 */
export interface TecladoProfessorProps {
  esperadas?: NotaPasso[]
  /** passo seguinte (contorno fraco) */
  seguintes?: NotaPasso[]
  pressionadas?: Set<number>
  erradas?: Set<number>
  acertos?: Set<number>
  divisao?: number
  ocultarDicas?: boolean
  estiloNome?: EstiloNome
  nomes?: 'destacadas' | 'todas'
  som?: boolean
  onNote?: (midi: number, ligado: boolean) => void
  /** altura das teclas brancas em px */
  altura?: number
  /** notas que devem caber na tela (região da música) */
  regiao?: [number, number]
  /** mostra a legenda de cores embaixo */
  legenda?: boolean
}

const MIN = 36
const MAX = 96
const BRANCAS: number[] = []
for (let n = MIN; n <= MAX; n++) if (!ehPreta(n)) BRANCAS.push(n)

function idxBranca(midi: number): number {
  let i = 0
  for (let n = MIN; n < midi; n++) if (!ehPreta(n)) i++
  return i
}

export default function TecladoProfessor({
  esperadas = [],
  seguintes = [],
  pressionadas,
  erradas,
  acertos,
  divisao = 60,
  ocultarDicas = false,
  estiloNome = 'do',
  nomes = 'destacadas',
  som = true,
  onNote,
  altura = 150,
  regiao,
  legenda = true,
}: TecladoProfessorProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [larguraTela, setLarguraTela] = useState(360)
  const [zoom, setZoom] = useState<'regiao' | 'todas' | number>('regiao')
  const [tocandoTela, setTocandoTela] = useState<Set<number>>(new Set())
  const ponteiros = useRef(new Map<number, number>())
  const [janela, setJanela] = useState({ inicio: 0, largura: 1 })

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setLarguraTela(el.clientWidth))
    ro.observe(el)
    setLarguraTela(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  // largura de cada tecla branca
  const W = useMemo(() => {
    const util = Math.max(200, larguraTela - 4)
    if (zoom === 'todas') return Math.max(9, util / BRANCAS.length)
    if (typeof zoom === 'number') return zoom
    // região: cabe a extensão da música (mín. ~1,5 oitava), com teclas entre 17 e 46 px
    // (as duas mãos ficam visíveis juntas; para tocar na tela, use o + para aumentar)
    const [a, b] = regiao ?? [55, 79]
    const brancasRegiao = Math.max(11, idxBranca(Math.min(MAX, b + 1)) - idxBranca(Math.max(MIN, a - 1)) + 1)
    return Math.min(46, Math.max(17, util / brancasRegiao))
  }, [zoom, larguraTela, regiao])

  const larguraTotal = BRANCAS.length * W
  const mapaEsp = useMemo(() => new Map(esperadas.map((n) => [n.midi, n])), [esperadas])
  const setSeg = useMemo(() => new Set(seguintes.map((n) => n.midi)), [seguintes])

  const atualizarJanela = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setJanela({ inicio: el.scrollLeft / larguraTotal, largura: Math.min(1, el.clientWidth / larguraTotal) })
  }, [larguraTotal])

  // mantém as próximas teclas visíveis
  const alvo = esperadas.length ? esperadas : seguintes
  const chave = alvo.length ? `${Math.min(...alvo.map((n) => n.midi))}-${Math.max(...alvo.map((n) => n.midi))}` : ''
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (!alvo.length) {
      if (regiao) {
        const c = (regiao[0] + regiao[1]) / 2
        el.scrollTo({ left: Math.max(0, idxBranca(Math.round(c)) * W - el.clientWidth / 2) })
      }
      atualizarJanela()
      return
    }
    const lo = idxBranca(Math.min(...alvo.map((n) => n.midi))) * W
    const hi = (idxBranca(Math.max(...alvo.map((n) => n.midi))) + 1) * W
    const margem = W * 1.5
    if (lo - margem < el.scrollLeft || hi + margem > el.scrollLeft + el.clientWidth) {
      el.scrollTo({ left: Math.max(0, (lo + hi) / 2 - el.clientWidth / 2), behavior: 'smooth' })
    }
    atualizarJanela()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, W])

  const ligar = useCallback(
    (midi: number) => {
      if (som) tocarNota(midi)
      setTocandoTela((s) => new Set(s).add(midi))
      onNote?.(midi, true)
    },
    [som, onNote],
  )
  const desligar = useCallback(
    (midi: number) => {
      if (som) soltarNota(midi)
      setTocandoTela((s) => {
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

  const estado = (midi: number): string => {
    if (erradas?.has(midi)) return 'errada'
    // a próxima tecla acesa tem prioridade sobre o "acerto" piscando (nota repetida)
    const esp = mapaEsp.get(midi)
    if (esp && !ocultarDicas) return esp.mao === 'esquerda' ? 'esperada-esquerda' : 'esperada-direita'
    if (acertos?.has(midi)) return 'acerto'
    if (pressionadas?.has(midi) || tocandoTela.has(midi)) return 'pressionada'
    if (setSeg.has(midi) && !ocultarDicas) return 'seguinte'
    return 'normal'
  }
  const apertada = (midi: number) => Boolean(pressionadas?.has(midi) || tocandoTela.has(midi))

  const COR_BRANCA: Record<string, string> = {
    errada: 'bg-red-500 text-white',
    acerto: 'bg-lime-300 ring-4 ring-inset ring-lime-500',
    'esperada-direita': 'bg-sky-200 shadow-[inset_0_-10px_0_0_rgba(14,165,233,0.95)]',
    'esperada-esquerda': 'bg-emerald-200 shadow-[inset_0_-10px_0_0_rgba(16,185,129,0.95)]',
    pressionada: 'bg-amber-200',
    seguinte: 'bg-white shadow-[inset_0_-4px_0_0_rgba(148,163,184,0.9)]',
    normal: 'bg-gradient-to-b from-white to-zinc-100',
  }
  const COR_PRETA: Record<string, string> = {
    errada: 'bg-red-600',
    acerto: 'bg-lime-500',
    'esperada-direita': 'bg-sky-600 ring-2 ring-sky-300',
    'esperada-esquerda': 'bg-emerald-600 ring-2 ring-emerald-300',
    pressionada: 'bg-amber-500',
    seguinte: 'bg-zinc-700 ring-1 ring-slate-400',
    normal: 'bg-gradient-to-b from-zinc-700 to-black',
  }

  const mostrarNome = (midi: number) => {
    if (ocultarDicas) return midi % 12 === 0 && W >= 18
    return nomes === 'todas' ? W >= 18 : mapaEsp.has(midi) || apertada(midi) || erradas?.has(midi) || (midi % 12 === 0 && W >= 18)
  }

  const xDivisao = idxBranca(divisao) * W
  const passoZoom = (d: number) => setZoom((z) => Math.min(60, Math.max(10, Math.round((typeof z === 'number' ? z : W) + d))))

  return (
    <div className="select-none" aria-label="Teclado completo do Casio CT-S300 (61 teclas)">
      <div className="mb-1.5 flex items-center gap-1.5">
        <div
          className="relative h-6 flex-1 cursor-pointer overflow-hidden rounded-md bg-slate-200"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            const el = scrollRef.current
            if (el) el.scrollTo({ left: ((e.clientX - r.left) / r.width) * larguraTotal - el.clientWidth / 2, behavior: 'smooth' })
          }}
          role="slider"
          aria-label="Mapa das 61 teclas"
          aria-valuenow={Math.round(janela.inicio * 100)}
          data-testid="mapa-teclado"
        >
          <div className="absolute inset-0 flex">
            {BRANCAS.map((n) => {
              const e = estado(n)
              return (
                <div
                  key={n}
                  className={`flex-1 border-r border-slate-400/60 ${e === 'esperada-direita' ? 'bg-sky-400' : e === 'esperada-esquerda' ? 'bg-emerald-400' : e === 'errada' ? 'bg-red-500' : apertada(n) ? 'bg-amber-300' : ''}`}
                />
              )
            })}
          </div>
          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-fuchsia-500" style={{ left: `${(xDivisao / larguraTotal) * 100}%` }} />
          <div
            className="pointer-events-none absolute inset-y-0 rounded-sm border-2 border-amber-400 bg-amber-400/15"
            style={{ left: `${janela.inicio * 100}%`, width: `${janela.largura * 100}%` }}
          />
        </div>
        <button type="button" onClick={() => passoZoom(-4)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white active:scale-95" aria-label="Diminuir teclas">
          <Minus size={16} />
        </button>
        <button type="button" onClick={() => passoZoom(4)} className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-white active:scale-95" aria-label="Aumentar teclas">
          <Plus size={16} />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => (z === 'todas' ? 'regiao' : 'todas'))}
          className={`flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-bold active:scale-95 ${zoom === 'todas' ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-white'}`}
          aria-label="Mostrar as 61 teclas"
        >
          <Maximize2 size={14} /> 61
        </button>
      </div>

      <div
        ref={scrollRef}
        onScroll={atualizarJanela}
        className="teclado-scroll overflow-x-auto rounded-xl border border-white/10 bg-gradient-to-b from-zinc-800 to-zinc-950 px-0.5 pb-1 pt-4"
        data-testid="teclado-scroll"
      >
        <div
          className="relative touch-none"
          style={{ width: larguraTotal, height: altura }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* marcador da divisão entre as mãos */}
          <div className="pointer-events-none absolute -top-3.5 z-30 flex -translate-x-1/2 flex-col items-center" style={{ left: xDivisao }}>
            <span className="whitespace-nowrap rounded bg-fuchsia-600 px-1 text-[9px] font-bold leading-tight text-white">◀ E | D ▶</span>
          </div>
          <div className="pointer-events-none absolute top-0 z-20 h-full w-0.5 bg-fuchsia-500/80" style={{ left: xDivisao - 1 }} />

          {BRANCAS.map((n, i) => {
            const e = estado(n)
            const esp = mapaEsp.get(n)
            return (
              <div
                key={n}
                data-midi={n}
                data-estado={e}
                aria-label={nomeComOitava(n, estiloNome)}
                className={`absolute top-0 flex flex-col items-center justify-end rounded-b-md border border-zinc-400 pb-1.5 transition-[background-color,transform] duration-75 ${COR_BRANCA[e]} ${apertada(n) ? 'translate-y-[2px] brightness-95' : ''}`}
                style={{ left: i * W, width: W, height: altura }}
              >
                {esp?.dedo && !ocultarDicas && (
                  <span
                    className={`mb-1 grid place-items-center rounded-full font-black text-white ${esp.mao === 'esquerda' ? 'bg-emerald-600' : 'bg-sky-600'}`}
                    style={{ width: Math.min(22, W - 4), height: Math.min(22, W - 4), fontSize: Math.min(12, W / 2.2) }}
                  >
                    {esp.dedo}
                  </span>
                )}
                {mostrarNome(n) && (
                  <span className="font-bold leading-none text-slate-800" style={{ fontSize: Math.max(8, Math.min(11, W / 3.2)) }}>
                    {nome(n, estiloNome)}
                  </span>
                )}
                {n % 12 === 0 && W >= 22 && <span className="mt-0.5 text-[8px] leading-none text-slate-500">{Math.floor(n / 12) - 1}</span>}
              </div>
            )
          })}
          {Array.from({ length: MAX - MIN + 1 }, (_, k) => MIN + k)
            .filter(ehPreta)
            .map((n) => {
              const e = estado(n)
              const esp = mapaEsp.get(n)
              const w = W * 0.62
              const x = idxBranca(n) * W
              return (
                <div
                  key={n}
                  data-midi={n}
                  data-estado={e}
                  aria-label={nomeComOitava(n, estiloNome)}
                  className={`absolute top-0 z-10 flex flex-col items-center justify-end rounded-b pb-1 transition-[background-color,transform] duration-75 ${COR_PRETA[e]} ${apertada(n) ? 'translate-y-[2px]' : ''}`}
                  style={{ left: x - w / 2, width: w, height: altura * 0.62 }}
                >
                  {esp?.dedo && !ocultarDicas && (
                    <span
                      className={`mb-0.5 grid place-items-center rounded-full font-black text-white ${esp.mao === 'esquerda' ? 'bg-emerald-800' : 'bg-sky-800'}`}
                      style={{ width: Math.min(18, w - 2), height: Math.min(18, w - 2), fontSize: Math.min(10, w / 2.2) }}
                    >
                      {esp.dedo}
                    </span>
                  )}
                  {mostrarNome(n) && !(n % 12 === 0) && (
                    <span className="font-bold leading-none text-white" style={{ fontSize: Math.max(7, Math.min(9, w / 2.6)) }}>
                      {nome(n, estiloNome)}
                    </span>
                  )}
                </div>
              )
            })}
        </div>
      </div>
      {!ocultarDicas && legenda && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> mão direita
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> mão esquerda
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> erro
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" /> tecla apertada
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-0.5 bg-fuchsia-500" /> divisão das mãos
          </span>
        </div>
      )}
    </div>
  )
}
