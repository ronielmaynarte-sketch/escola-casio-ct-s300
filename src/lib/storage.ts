// Camada de dados do aluno.
// A interface ProgressStore permite trocar o armazenamento sem mexer nas telas:
// hoje usamos LocalStorageStore (no navegador); depois pode entrar um SupabaseStore
// com os mesmos métodos.

export type TipoAtividade =
  | 'aula_iniciada'
  | 'aula_concluida'
  | 'aula_repetida'
  | 'praticar_mais'
  | 'verificacao_ok'
  | 'estudo'
  | 'conquista'
  | 'musica'

export interface Atividade {
  id: string
  tipo: TipoAtividade
  /** ISO 8601 */
  em: string
  aulaId?: string
  descricao: string
  /** segundos (para tipo 'estudo') */
  segundos?: number
}

export interface RegistroAula {
  concluidaEm: string
  vezes: number
}

export interface ProgressData {
  versao: 1
  aulasConcluidas: Record<string, RegistroAula>
  /** Verificações interativas aprovadas (nota/sequência/acorde/quiz) por aula. */
  verificacoes: Record<string, string>
  /** Segundos estudados por dia, chave AAAA-MM-DD (horário local). */
  tempoPorDia: Record<string, number>
  /** Segundos estudados por aula. */
  tempoPorAula: Record<string, number>
  historico: Atividade[]
  /** id da conquista -> data ISO em que foi ganha */
  conquistas: Record<string, string>
  /** Dias (AAAA-MM-DD) com alguma atividade, para a sequência de dias. */
  diasAtivos: string[]
  ultimaAula?: string
}

export interface ProgressStore {
  load(): Promise<ProgressData>
  save(data: ProgressData): Promise<void>
  reset(): Promise<void>
}

export function progressoVazio(): ProgressData {
  return {
    versao: 1,
    aulasConcluidas: {},
    verificacoes: {},
    tempoPorDia: {},
    tempoPorAula: {},
    historico: [],
    conquistas: {},
    diasAtivos: [],
  }
}

const CHAVE = 'escola-ct-s300:progresso:v1'
const LIMITE_HISTORICO = 500

export class LocalStorageStore implements ProgressStore {
  constructor(private chave: string = CHAVE) {}

  async load(): Promise<ProgressData> {
    try {
      const bruto = localStorage.getItem(this.chave)
      if (!bruto) return progressoVazio()
      const dados = JSON.parse(bruto) as Partial<ProgressData>
      return { ...progressoVazio(), ...dados, versao: 1 }
    } catch {
      return progressoVazio()
    }
  }

  async save(data: ProgressData): Promise<void> {
    const enxuto: ProgressData = {
      ...data,
      historico: data.historico.slice(-LIMITE_HISTORICO),
    }
    try {
      localStorage.setItem(this.chave, JSON.stringify(enxuto))
    } catch {
      // armazenamento cheio ou bloqueado: o app continua funcionando em memória
    }
  }

  async reset(): Promise<void> {
    localStorage.removeItem(this.chave)
  }
}

// Exemplo de como ficará a versão em nuvem (Etapa futura):
// export class SupabaseStore implements ProgressStore {
//   constructor(private client: SupabaseClient, private userId: string) {}
//   async load() { /* select data from progresso where user_id = ... */ }
//   async save(data) { /* upsert { user_id, data } */ }
//   async reset() { /* delete */ }
// }

export function hojeISO(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

/** Dias seguidos com atividade, terminando hoje (ou ontem, se hoje ainda não estudou). */
export function calcularSequencia(diasAtivos: string[], hoje: Date = new Date()): number {
  const set = new Set(diasAtivos)
  const d = new Date(hoje)
  if (!set.has(hojeISO(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (set.has(hojeISO(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

export function novoId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
