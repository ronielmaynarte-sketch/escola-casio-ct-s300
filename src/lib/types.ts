// Tipos do conteúdo do curso (src/content/*.json)

export type Mao = 'direita' | 'esquerda'

export interface DedoInfo {
  dedo: 1 | 2 | 3 | 4 | 5 | number
  mao: Mao
}

export interface PerguntaQuiz {
  pergunta: string
  opcoes: string[]
  correta: number
}

export type Criterio =
  | { tipo: 'manual'; instrucao?: string }
  | { tipo: 'nota'; nota: number; instrucao?: string }
  | { tipo: 'sequencia'; notas: number[]; instrucao?: string }
  | { tipo: 'acorde'; notas: number[]; instrucao?: string }
  | { tipo: 'quiz'; perguntas: PerguntaQuiz[] }

export interface Tempos {
  explicacao: number
  observacao: number
  pratica: number
  exercicio: number
}

export type StatusConteudo = 'pronta' | 'em_preparo'

export interface Aula {
  id: string
  titulo: string
  status: StatusConteudo
  objetivo?: string
  vaiAprender?: string[]
  /** Parágrafos com marcação simples: **negrito** e linhas iniciadas por "- " viram lista. */
  explicacao?: string[]
  /** Números MIDI (C4 = 60 = Dó central). */
  teclas?: number[]
  /** Mapa MIDI -> dedo e mão. */
  dedos?: Record<string, DedoInfo>
  exercicioGuiado?: string[]
  tempos?: Tempos
  desafio?: string
  criterio?: Criterio
}

export interface Modulo {
  id: string
  numero: number
  titulo: string
  descricao: string
  aulas: Aula[]
}

export interface Conquista {
  id: string
  titulo: string
  descricao: string
  icone: string
}

export type StatusModulo = 'disponivel' | 'andamento' | 'concluido' | 'bloqueado'
export type StatusAula = 'concluida' | 'disponivel' | 'bloqueada' | 'em_preparo'
