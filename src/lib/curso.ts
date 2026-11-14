import modulosJson from '../content/modules.json'
import conquistasJson from '../content/achievements.json'
import cursoJson from '../content/course.json'
import type { Aula, Conquista, Modulo, StatusAula, StatusModulo } from './types'
import type { ProgressData } from './storage'
import { calcularSequencia } from './storage'

export const MODULOS = modulosJson as unknown as Modulo[]
export const CONQUISTAS = conquistasJson as Conquista[]
export const CURSO = cursoJson as {
  nome: string
  teclado: string
  subtitulo: string
  notaMin: number
  notaMax: number
}

export interface AulaLocalizada {
  aula: Aula
  modulo: Modulo
  indice: number // posição dentro do módulo
}

const TODAS: AulaLocalizada[] = MODULOS.flatMap((modulo) =>
  modulo.aulas.map((aula, indice) => ({ aula, modulo, indice })),
)

export const TOTAL_AULAS = TODAS.length

export function acharAula(id: string): AulaLocalizada | undefined {
  return TODAS.find((x) => x.aula.id === id)
}

export function acharModulo(id: string): Modulo | undefined {
  return MODULOS.find((m) => m.id === id)
}

const concluida = (p: ProgressData, id: string) => Boolean(p.aulasConcluidas[id])

export function moduloConcluido(m: Modulo, p: ProgressData): boolean {
  return m.aulas.length > 0 && m.aulas.every((a) => concluida(p, a.id))
}

export function moduloDesbloqueado(m: Modulo, p: ProgressData): boolean {
  const i = MODULOS.findIndex((x) => x.id === m.id)
  if (i <= 0) return true
  return moduloConcluido(MODULOS[i - 1], p)
}

export function statusModulo(m: Modulo, p: ProgressData): StatusModulo {
  if (!moduloDesbloqueado(m, p)) return 'bloqueado'
  if (moduloConcluido(m, p)) return 'concluido'
  if (m.aulas.some((a) => concluida(p, a.id))) return 'andamento'
  return 'disponivel'
}

export function moduloTemConteudo(m: Modulo): boolean {
  return m.aulas.some((a) => a.status === 'pronta')
}

export function statusAula(id: string, p: ProgressData): StatusAula {
  const loc = acharAula(id)
  if (!loc) return 'bloqueada'
  const { aula, modulo, indice } = loc
  if (concluida(p, aula.id)) return 'concluida'
  if (!moduloDesbloqueado(modulo, p)) return 'bloqueada'
  const anterior = indice > 0 ? modulo.aulas[indice - 1] : undefined
  if (anterior && !concluida(p, anterior.id)) return 'bloqueada'
  if (aula.status !== 'pronta') return 'em_preparo'
  return 'disponivel'
}

export function progressoModulo(m: Modulo, p: ProgressData): number {
  if (!m.aulas.length) return 0
  return Math.round((m.aulas.filter((a) => concluida(p, a.id)).length / m.aulas.length) * 100)
}

export function progressoGeral(p: ProgressData): number {
  const n = TODAS.filter((x) => concluida(p, x.aula.id)).length
  return Math.round((n / TOTAL_AULAS) * 100)
}

export function totalConcluidas(p: ProgressData): number {
  return TODAS.filter((x) => concluida(p, x.aula.id)).length
}

/** Próxima aula que o aluno deve fazer (desbloqueada e não concluída). */
export function proximaAula(p: ProgressData): { loc: AulaLocalizada; status: StatusAula } | undefined {
  for (const loc of TODAS) {
    const s = statusAula(loc.aula.id, p)
    if (s === 'disponivel' || s === 'em_preparo') return { loc, status: s }
    if (s === 'bloqueada') return undefined
  }
  return undefined
}

export function moduloAtual(p: ProgressData): Modulo {
  const prox = proximaAula(p)
  if (prox) return prox.loc.modulo
  const ultimoConcluido = [...MODULOS].reverse().find((m) => moduloConcluido(m, p))
  return ultimoConcluido ?? MODULOS[0]
}

export function proximaAulaDepois(id: string): AulaLocalizada | undefined {
  const i = TODAS.findIndex((x) => x.aula.id === id)
  return i >= 0 ? TODAS[i + 1] : undefined
}

export function tempoTotal(p: ProgressData): number {
  return Object.values(p.tempoPorDia).reduce((a, b) => a + b, 0)
}

/** Lista das conquistas que o aluno já merece (usada após cada mudança). */
export function conquistasMerecidas(p: ProgressData): string[] {
  const ids: string[] = []
  const n = totalConcluidas(p)
  const seq = calcularSequencia(p.diasAtivos)
  if (n >= 1) ids.push('primeira-aula')
  if (n >= 5) ids.push('cinco-aulas')
  if (n >= 10) ids.push('dez-aulas')
  if (seq >= 3) ids.push('tres-dias')
  if (seq >= 7) ids.push('sete-dias')
  if (tempoTotal(p) >= 3600) ids.push('uma-hora')
  if (moduloConcluido(MODULOS[0], p)) ids.push('modulo-1')
  if (moduloConcluido(MODULOS[1], p)) ids.push('modulo-2')
  return ids
}

export function formatarDuracao(seg: number): string {
  const s = Math.max(0, Math.floor(seg))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`
  if (m > 0) return `${m} min`
  return `${s % 60} s`
}

export function formatarRelogio(seg: number): string {
  const s = Math.max(0, Math.floor(seg))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
