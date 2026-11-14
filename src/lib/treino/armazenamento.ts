// Dados do "professor" (tocar junto): configurações, histórico de avaliações e músicas importadas.
// Mesmo padrão do progresso do curso: tudo no localStorage deste aparelho.

import type { EstiloNome } from '../musica/notas'
import type { Modo, MusicaDef, Nivel } from '../musica/tipos'

export type FontePreferida = 'auto' | 'microfone' | 'midi' | 'toque'

export interface Configuracoes {
  fonte: FontePreferida
  divisao: number
  volumeMetronomo: number // 0–1
  velocidadePadrao: number // 0.4–1.2
  estiloNome: EstiloNome
  /** nível de ruído medido na calibração (RMS) */
  ruidoMic: number | null
  /** sensibilidade 0.5 (menos) – 2 (mais) */
  sensibilidadeMic: number
  janelaAcordeMs: number
  somDoTeclado: boolean
}

export const CONFIG_PADRAO: Configuracoes = {
  fonte: 'auto',
  divisao: 60,
  volumeMetronomo: 0.6,
  velocidadePadrao: 0.8,
  estiloNome: 'do',
  ruidoMic: null,
  sensibilidadeMic: 1,
  janelaAcordeMs: 150,
  somDoTeclado: true,
}

export interface RegistroTreino {
  id: string
  em: string
  musicaId: string
  titulo: string
  nivel: Nivel
  modo: Modo | 'licao'
  licao?: string
  corretas: number
  erradas: number
  ritmo: number | null
  tempoMs: number
  pontuacao: number
  precisaoNotas: number
  pontosAMelhorar: string[]
  fonte: string
}

const K_CONFIG = 'escola-ct-s300:treino-config:v1'
const K_HIST = 'escola-ct-s300:treino-historico:v1'
const K_MUSICAS = 'escola-ct-s300:musicas-importadas:v1'
const LIMITE_HIST = 400

function ler<T>(k: string, padrao: T): T {
  try {
    const b = localStorage.getItem(k)
    return b ? (JSON.parse(b) as T) : padrao
  } catch {
    return padrao
  }
}
function gravar(k: string, v: unknown): boolean {
  try {
    localStorage.setItem(k, JSON.stringify(v))
    return true
  } catch {
    return false
  }
}

export function lerConfig(): Configuracoes {
  return { ...CONFIG_PADRAO, ...ler<Partial<Configuracoes>>(K_CONFIG, {}) }
}
export function salvarConfig(c: Configuracoes): void {
  gravar(K_CONFIG, c)
  window.dispatchEvent(new CustomEvent('treino-config'))
}

export function lerHistorico(): RegistroTreino[] {
  return ler<RegistroTreino[]>(K_HIST, [])
}
export function adicionarHistorico(r: RegistroTreino): void {
  const h = lerHistorico()
  h.push(r)
  gravar(K_HIST, h.slice(-LIMITE_HIST))
}
export function limparHistorico(): void {
  localStorage.removeItem(K_HIST)
}

export function lerMusicasImportadas(): MusicaDef[] {
  return ler<MusicaDef[]>(K_MUSICAS, [])
}
/** Retorna false se o armazenamento do aparelho estiver cheio. */
export function salvarMusicaImportada(m: MusicaDef): boolean {
  const lst = lerMusicasImportadas().filter((x) => x.id !== m.id)
  lst.push(m)
  return gravar(K_MUSICAS, lst)
}
export function apagarMusicaImportada(id: string): void {
  gravar(
    K_MUSICAS,
    lerMusicasImportadas().filter((x) => x.id !== id),
  )
}

/** Recomenda subir de nível depois de 2 avaliações com 90% ou mais naquele nível. */
export function recomendacaoNivel(hist: RegistroTreino[], musicaId: string, nivel: Nivel): Nivel | null {
  const ok = hist.filter((r) => r.musicaId === musicaId && r.nivel === nivel && r.pontuacao >= 90).length
  if (ok < 2) return null
  return nivel === 'facil' ? 'intermediario' : nivel === 'intermediario' ? 'avancado' : null
}
