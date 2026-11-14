// Tipos do sistema "professor" (tocar junto).

export type Mao = 'direita' | 'esquerda'
export type Nivel = 'facil' | 'intermediario' | 'avancado'
export const NIVEIS: Nivel[] = ['facil', 'intermediario', 'avancado']
export const NOME_NIVEL: Record<Nivel, string> = { facil: 'Fácil', intermediario: 'Intermediário', avancado: 'Avançado' }

/** Modos de prática. */
export type Modo = 'direita' | 'esquerda' | 'separadas' | 'juntas' | 'facil' | 'desafio'
export const MODOS: Modo[] = ['direita', 'esquerda', 'separadas', 'juntas', 'facil', 'desafio']
export const NOME_MODO: Record<Modo, string> = {
  direita: 'Só mão direita',
  esquerda: 'Só mão esquerda',
  separadas: 'Mãos separadas',
  juntas: 'Mãos juntas',
  facil: 'Fácil',
  desafio: 'Desafio',
}
export const DESCRICAO_MODO: Record<Modo, string> = {
  direita: 'Toque só a melodia da mão direita.',
  esquerda: 'Toque só o acompanhamento da mão esquerda.',
  separadas: 'Primeiro a direita, depois a esquerda, depois as duas juntas.',
  juntas: 'As duas mãos ao mesmo tempo.',
  facil: 'Só as notas da melodia, mais devagar.',
  desafio: 'Sem nomes, sem dedos e sem luz nas próximas teclas. Só aviso de erro.',
}

/** Uma nota de uma música, com tempo em batidas (unidade = figura do denominador do compasso). */
export interface NotaEv {
  midi: number
  inicio: number
  dur: number
  mao: Mao
  dedo?: number
}

export interface SecaoDef {
  nome: string
  inicio: number
  fim: number
}

export type Categoria = 'classicas' | 'infantis' | 'natal' | 'festas' | 'gonzaga' | 'moderno' | 'importadas'

export interface MusicaDef {
  id: string
  titulo: string
  compositor: string
  categoria: Categoria
  origem: 'embutida' | 'importada'
  compasso: [number, number]
  bpm: number
  tonalidade?: string
  descricao?: string
  /** Por que a música pode estar no app (domínio público) ou "arquivo do usuário". */
  licenca: string
  /** Fontes usadas para conferir a melodia. */
  fontes?: string[]
  /** Cantigas folclóricas: a altura das notas é conferida, mas o ritmo é aproximado. */
  ritmoAproximado?: boolean
  /** Ponto de divisão sugerido entre as mãos (MIDI da primeira tecla da mão direita). */
  divisao?: number
  observacoes?: Partial<Record<Nivel, string>>
  niveis: Record<Nivel, NotaEv[]>
  secoes: SecaoDef[]
}

/** Uma nota dentro de um passo. */
export interface NotaPasso {
  midi: number
  mao: Mao
  dedo?: number
}

/** Um passo do "modo espera": o conjunto de notas que começam juntas. */
export interface Passo {
  /** posição em batidas desde o início da música */
  t: number
  /** duração em batidas até o próximo passo (ou fim da nota) */
  dur: number
  notas: NotaPasso[]
  secao: number
  compasso: number
}
