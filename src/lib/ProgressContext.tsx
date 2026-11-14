import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { LocalStorageStore, hojeISO, novoId, progressoVazio } from './storage'
import type { Atividade, ProgressData, ProgressStore, TipoAtividade } from './storage'
import { CONQUISTAS, acharAula, conquistasMerecidas } from './curso'

interface ProgressApi {
  dados: ProgressData
  carregado: boolean
  concluirAula: (aulaId: string) => void
  marcarVerificacao: (aulaId: string) => void
  registrarTempo: (aulaId: string, segundos: number) => void
  registrarAtividade: (tipo: TipoAtividade, descricao: string, aulaId?: string) => void
  marcarUltimaAula: (aulaId: string) => void
  resetar: () => void
  /** Conquistas recém-ganhas (para mostrar aviso). */
  novasConquistas: string[]
  limparNovasConquistas: () => void
}

const Ctx = createContext<ProgressApi | null>(null)

function comAtividade(d: ProgressData, tipo: TipoAtividade, descricao: string, aulaId?: string, segundos?: number): ProgressData {
  const a: Atividade = { id: novoId(), tipo, em: new Date().toISOString(), descricao, aulaId, segundos }
  const hoje = hojeISO()
  // Só abrir uma aula não conta como dia de estudo para a sequência.
  const contaDia = tipo !== 'aula_iniciada'
  const diasAtivos = !contaDia || d.diasAtivos.includes(hoje) ? d.diasAtivos : [...d.diasAtivos, hoje]
  return { ...d, historico: [...d.historico, a], diasAtivos }
}

export function ProgressProvider({ children, store }: { children: ReactNode; store?: ProgressStore }) {
  const storeRef = useRef<ProgressStore>(store ?? new LocalStorageStore())
  const [dados, setDados] = useState<ProgressData>(progressoVazio)
  const [carregado, setCarregado] = useState(false)
  const [novasConquistas, setNovas] = useState<string[]>([])

  useEffect(() => {
    let vivo = true
    storeRef.current.load().then((d) => {
      if (vivo) {
        setDados(d)
        setCarregado(true)
      }
    })
    return () => {
      vivo = false
    }
  }, [])

  // Salvamento automático a cada mudança (depois do primeiro carregamento).
  useEffect(() => {
    if (carregado) void storeRef.current.save(dados)
  }, [dados, carregado])

  const atualizar = useCallback((fn: (d: ProgressData) => ProgressData) => {
    setDados((antes) => {
      let d = fn(antes)
      const merecidas = conquistasMerecidas(d).filter((id) => !d.conquistas[id])
      if (merecidas.length) {
        const agora = new Date().toISOString()
        const conquistas = { ...d.conquistas }
        for (const id of merecidas) {
          conquistas[id] = agora
          const c = CONQUISTAS.find((x) => x.id === id)
          d = comAtividade(d, 'conquista', `Conquista: ${c?.titulo ?? id}`)
        }
        d = { ...d, conquistas }
        queueMicrotask(() => setNovas((n) => Array.from(new Set([...n, ...merecidas]))))
      }
      return d
    })
  }, [])

  const api = useMemo<ProgressApi>(
    () => ({
      dados,
      carregado,
      novasConquistas,
      limparNovasConquistas: () => setNovas([]),
      concluirAula: (aulaId) =>
        atualizar((d) => {
          const titulo = acharAula(aulaId)?.aula.titulo ?? aulaId
          const ant = d.aulasConcluidas[aulaId]
          const reg = ant
            ? { concluidaEm: ant.concluidaEm, vezes: ant.vezes + 1 }
            : { concluidaEm: new Date().toISOString(), vezes: 1 }
          const d2 = { ...d, aulasConcluidas: { ...d.aulasConcluidas, [aulaId]: reg } }
          return comAtividade(d2, ant ? 'aula_repetida' : 'aula_concluida', `${ant ? 'Repetiu' : 'Concluiu'}: ${titulo}`, aulaId)
        }),
      marcarVerificacao: (aulaId) =>
        atualizar((d) => {
          if (d.verificacoes[aulaId]) return d
          const titulo = acharAula(aulaId)?.aula.titulo ?? aulaId
          const d2 = { ...d, verificacoes: { ...d.verificacoes, [aulaId]: new Date().toISOString() } }
          return comAtividade(d2, 'verificacao_ok', `Desafio aprovado: ${titulo}`, aulaId)
        }),
      registrarTempo: (aulaId, segundos) => {
        if (segundos <= 0) return
        atualizar((d) => {
          const hoje = hojeISO()
          const tempoPorDia = { ...d.tempoPorDia, [hoje]: (d.tempoPorDia[hoje] ?? 0) + segundos }
          const tempoPorAula = { ...d.tempoPorAula, [aulaId]: (d.tempoPorAula[aulaId] ?? 0) + segundos }
          const diasAtivos = d.diasAtivos.includes(hoje) ? d.diasAtivos : [...d.diasAtivos, hoje]
          // Junta tempo na última atividade de estudo da mesma aula no mesmo dia, para não poluir o histórico.
          const hist = [...d.historico]
          const ult = hist[hist.length - 1]
          if (ult && ult.tipo === 'estudo' && ult.aulaId === aulaId && hojeISO(new Date(ult.em)) === hoje) {
            hist[hist.length - 1] = { ...ult, segundos: (ult.segundos ?? 0) + segundos }
          } else {
            const titulo = acharAula(aulaId)?.aula.titulo ?? aulaId
            hist.push({ id: novoId(), tipo: 'estudo', em: new Date().toISOString(), aulaId, descricao: `Estudou: ${titulo}`, segundos })
          }
          return { ...d, tempoPorDia, tempoPorAula, diasAtivos, historico: hist }
        })
      },
      registrarAtividade: (tipo, descricao, aulaId) => atualizar((d) => comAtividade(d, tipo, descricao, aulaId)),
      marcarUltimaAula: (aulaId) => setDados((d) => (d.ultimaAula === aulaId ? d : { ...d, ultimaAula: aulaId })),
      resetar: () => {
        void storeRef.current.reset()
        setDados(progressoVazio())
      },
    }),
    [dados, carregado, novasConquistas, atualizar],
  )

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useProgresso(): ProgressApi {
  const c = useContext(Ctx)
  if (!c) throw new Error('useProgresso precisa estar dentro de ProgressProvider')
  return c
}
