import { useCallback, useMemo, useRef, useState } from 'react'
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react'
import Teclado61 from './Teclado61'
import type { Aula, Criterio, PerguntaQuiz } from '../lib/types'
import { nomeNota } from '../lib/audio'

interface Props {
  aula: Aula
  aprovado: boolean
  onAprovado: () => void
}

/** Critérios que exigem verificação no teclado antes de concluir a aula. */
export function exigeVerificacao(c?: Criterio): boolean {
  return !!c && (c.tipo === 'nota' || c.tipo === 'sequencia' || c.tipo === 'acorde')
}

export default function Desafio({ aula, aprovado, onAprovado }: Props) {
  const c = aula.criterio
  if (!c) return null
  return (
    <div className="space-y-4">
      {aula.desafio && <p className="text-lg font-semibold leading-snug text-white">{aula.desafio}</p>}
      {'instrucao' in c && c.instrucao && <p className="text-sm text-slate-400">{c.instrucao}</p>}
      {c.tipo === 'nota' && <VerificaNotas alvo={[c.nota]} aula={aula} aprovado={aprovado} onAprovado={onAprovado} />}
      {c.tipo === 'sequencia' && <VerificaNotas alvo={c.notas} aula={aula} aprovado={aprovado} onAprovado={onAprovado} />}
      {c.tipo === 'acorde' && <VerificaAcorde alvo={c.notas} aula={aula} aprovado={aprovado} onAprovado={onAprovado} />}
      {c.tipo === 'quiz' && <Quiz perguntas={c.perguntas} aprovado={aprovado} onAprovado={onAprovado} />}
      {c.tipo === 'manual' && (
        <div className="rounded-2xl bg-white/5 p-4 text-sm text-slate-300">
          Este desafio é feito no seu CT-S300. Quando conseguir, toque em <strong className="text-white">CONSEGUI! PRÓXIMA AULA</strong>.
        </div>
      )}
    </div>
  )
}

function Aprovado({ texto = 'Desafio concluído! Você já pode ir para a próxima aula.' }: { texto?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/15 p-3 text-sm font-semibold text-emerald-300 animate-[surgir_.3s_ease-out]">
      <CheckCircle2 size={20} /> {texto}
    </div>
  )
}

function VerificaNotas({ alvo, aula, aprovado, onAprovado }: { alvo: number[]; aula: Aula; aprovado: boolean; onAprovado: () => void }) {
  const [pos, setPos] = useState(0)
  const [erro, setErro] = useState<number | null>(null)
  const [ok, setOk] = useState(false)
  const posRef = useRef(0)

  const onNote = useCallback(
    (midi: number, ligado: boolean) => {
      if (!ligado || ok) return
      const esperado = alvo[posRef.current]
      if (midi === esperado) {
        posRef.current += 1
        setPos(posRef.current)
        setErro(null)
        if (posRef.current >= alvo.length) {
          setOk(true)
          onAprovado()
        }
      } else {
        setErro(midi)
      }
    },
    [alvo, ok, onAprovado],
  )

  const reiniciar = () => {
    posRef.current = 0
    setPos(0)
    setErro(null)
    setOk(false)
  }

  const highlight = useMemo(() => Array.from(new Set(alvo)), [alvo])
  const proxima = alvo[pos]

  return (
    <div className="space-y-3">
      {alvo.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {alvo.map((n, i) => (
            <span
              key={i}
              className={`rounded-lg px-2 py-1 text-xs font-bold transition ${
                i < pos ? 'bg-emerald-500/20 text-emerald-300' : i === pos && !ok ? 'bg-amber-400 text-slate-950 scale-110' : 'bg-white/5 text-slate-400'
              }`}
            >
              {nomeNota(n)}
            </span>
          ))}
        </div>
      )}
      <div className="min-h-6 text-sm">
        {ok || (aprovado && pos === 0) ? (
          <Aprovado texto={ok ? undefined : 'Você já passou neste desafio. Pode praticar de novo à vontade.'} />
        ) : erro !== null ? (
          <span className="flex items-center gap-1.5 text-rose-300">
            <XCircle size={16} /> Você tocou {nomeNota(erro)}. Tente {nomeNota(proxima)}.
          </span>
        ) : (
          <span className="text-slate-300">
            Próxima nota: <strong className="text-amber-300">{nomeNota(proxima)}</strong>
            {alvo.length > 1 && ` (${pos + 1} de ${alvo.length})`}
          </span>
        )}
      </div>
      <Teclado61 highlight={highlight} fingers={aula.dedos} onNote={onNote} acertos={ok ? highlight : []} />
      {(pos > 0 || ok) && (
        <button type="button" onClick={reiniciar} className="flex items-center gap-2 text-sm text-slate-400 active:text-white">
          <RotateCcw size={16} /> Recomeçar desafio
        </button>
      )}
    </div>
  )
}

function VerificaAcorde({ alvo, aula, aprovado, onAprovado }: { alvo: number[]; aula: Aula; aprovado: boolean; onAprovado: () => void }) {
  const presas = useRef(new Set<number>())
  const recentes = useRef(new Map<number, number>())
  const [ok, setOk] = useState(false)
  const [tocadas, setTocadas] = useState<number[]>([])
  const JANELA_MS = 600

  const onNote = useCallback(
    (midi: number, ligado: boolean) => {
      if (ligado) {
        presas.current.add(midi)
        recentes.current.set(midi, performance.now())
      } else presas.current.delete(midi)
      if (ok || !ligado) return
      const agora = performance.now()
      const juntas = alvo.every((n) => presas.current.has(n) || agora - (recentes.current.get(n) ?? -Infinity) <= JANELA_MS)
      setTocadas(alvo.filter((n) => presas.current.has(n)))
      if (juntas) {
        setOk(true)
        onAprovado()
      }
    },
    [alvo, ok, onAprovado],
  )

  return (
    <div className="space-y-3">
      <div className="min-h-6 text-sm">
        {ok || aprovado ? (
          <Aprovado texto={ok ? undefined : 'Você já passou neste desafio. Pode praticar de novo à vontade.'} />
        ) : (
          <span className="text-slate-300">
            Toque juntas: <strong className="text-amber-300">{alvo.map(nomeNota).join(' + ')}</strong>
            {tocadas.length > 0 && tocadas.length < alvo.length && ' — falta a outra tecla, ao mesmo tempo!'}
          </span>
        )}
      </div>
      <Teclado61 highlight={alvo} fingers={aula.dedos} onNote={onNote} acertos={ok ? alvo : []} />
    </div>
  )
}

function Quiz({ perguntas, aprovado, onAprovado }: { perguntas: PerguntaQuiz[]; aprovado: boolean; onAprovado: () => void }) {
  const [resp, setResp] = useState<(number | null)[]>(() => perguntas.map(() => null))
  const [verificado, setVerificado] = useState(false)
  const acertos = resp.filter((r, i) => r === perguntas[i].correta).length
  const tudoCerto = acertos === perguntas.length

  const verificar = () => {
    setVerificado(true)
    if (resp.every((r, i) => r === perguntas[i].correta)) onAprovado()
  }

  return (
    <div className="space-y-4">
      {perguntas.map((p, i) => (
        <fieldset key={i} className="rounded-2xl bg-white/[0.04] p-4">
          <legend className="sr-only">{p.pergunta}</legend>
          <div className="mb-3 font-semibold text-white">
            {i + 1}. {p.pergunta}
          </div>
          <div className="grid gap-2">
            {p.opcoes.map((o, j) => {
              const sel = resp[i] === j
              const certo = verificado && sel && j === p.correta
              const errado = verificado && sel && j !== p.correta
              return (
                <button
                  key={j}
                  type="button"
                  onClick={() => {
                    setVerificado(false)
                    setResp((r) => r.map((x, k) => (k === i ? j : x)))
                  }}
                  className={`min-h-12 rounded-xl border px-4 py-2 text-left text-sm transition ${
                    certo
                      ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200'
                      : errado
                        ? 'border-rose-400 bg-rose-500/15 text-rose-200'
                        : sel
                          ? 'border-amber-400 bg-amber-400/10 text-white'
                          : 'border-white/10 bg-white/[0.02] text-slate-300 active:bg-white/10'
                  }`}
                >
                  {o}
                </button>
              )
            })}
          </div>
        </fieldset>
      ))}
      {verificado && tudoCerto ? (
        <Aprovado />
      ) : (
        <>
          {aprovado && !verificado && <Aprovado texto="Você já acertou este quiz antes. Pode refazer à vontade." />}
          {verificado && (
            <p className="text-sm text-rose-300">
              Você acertou {acertos} de {perguntas.length}. Revise a explicação e tente de novo.
            </p>
          )}
          <button
            type="button"
            disabled={resp.some((r) => r === null)}
            onClick={verificar}
            className="h-12 w-full rounded-2xl bg-white/10 font-semibold text-white disabled:opacity-40 active:scale-[0.99]"
          >
            Verificar respostas
          </button>
        </>
      )}
    </div>
  )
}
