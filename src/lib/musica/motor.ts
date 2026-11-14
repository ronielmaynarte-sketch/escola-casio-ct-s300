// Motor do "modo espera" (tocar junto). Puro: não usa DOM nem relógio próprio —
// quem chama informa o tempo (ms) de cada evento. Assim dá para testar com sequências simuladas.

import { explicarErro, nome } from './notas'
import type { EstiloNome } from './notas'
import { gerarPassos } from './passos'
import type { Plano, Trecho } from './passos'
import type { MusicaDef, Passo } from './tipos'

export type Julgamento = 'perfeito' | 'bom' | 'adiantado' | 'atrasado'

export interface OpcoesMotor {
  /** confere o tempo (metrônomo) além das notas */
  ritmo?: boolean
  /** 0.4 – 1.2 */
  velocidade?: number
  /** janela para as notas de um acorde (ms) */
  janelaAcordeMs?: number
  /** repete automaticamente trechos (seções) com 3 erros ou mais */
  repetirTrechosDificeis?: boolean
  /** recomeça o plano ao terminar */
  loop?: boolean
  /** ponto de divisão: notas da outra mão são ignoradas nos modos de uma mão só */
  divisao?: number
  estiloNome?: EstiloNome
}

export type TipoRetorno = 'acerto' | 'parcial' | 'erro' | 'ignorada' | 'acorde_separado' | 'fim_trecho' | 'fim'

export interface Retorno {
  tipo: TipoRetorno
  mensagem?: string
  midi?: number
  julgamento?: Julgamento
  /** desvio do tempo em ms (negativo = adiantado) */
  desvioMs?: number
  /** novo trecho (repetição) inserido por causa de erros */
  repeticao?: string
}

export interface RegistroErro {
  trecho: number
  passo: number
  compasso: number
  secao: number
  tocada: number
  esperadas: number[]
  t: number
}

export interface Resultado {
  corretas: number
  erradas: number
  passos: number
  ritmo: null | { perfeito: number; bom: number; adiantado: number; atrasado: number; precisao: number }
  tempoMs: number
  /** % de acerto de notas */
  precisaoNotas: number
  /** nota final 0–100 */
  pontuacao: number
  pontosAMelhorar: string[]
  errosPorCompasso: Record<number, number>
  errosPorNota: Record<number, number>
  trechosRepetidos: number
}

interface EstadoTrecho {
  trecho: Trecho
  passos: Passo[]
  tentativa: number
  /** repetição automática (nível de reforço) */
  reforco: number
}

export class MotorTocar {
  readonly musica: MusicaDef
  readonly plano: Plano
  readonly op: Required<Omit<OpcoesMotor, 'divisao'>> & { divisao: number }

  private fila: EstadoTrecho[] = []
  private iTrecho = 0
  private iPasso = 0
  private pressionadas = new Map<number, number>() // midi -> tempo da pressão (depois da ativação)
  private seguradas = new Set<number>()
  private ultimoPassoNotas: number[] = []
  private ultimoAcertoEm = -Infinity
  private referenciaRitmo: { t: number; batida: number } | null = null
  private inicioEm: number | null = null
  private fimEm: number | null = null
  private errosTrechoAtual = 0
  private errosPorSecaoNoTrecho = new Map<number, number>()
  private reforcos = new Map<string, number>()

  corretas = 0
  erros: RegistroErro[] = []
  julgamentos: Julgamento[] = []
  trechosRepetidos = 0
  terminou = false

  constructor(musica: MusicaDef, plano: Plano, op: OpcoesMotor = {}) {
    this.musica = musica
    this.plano = plano
    this.op = {
      ritmo: op.ritmo ?? false,
      velocidade: op.velocidade ?? 1,
      janelaAcordeMs: op.janelaAcordeMs ?? 150,
      repetirTrechosDificeis: op.repetirTrechosDificeis ?? true,
      loop: op.loop ?? false,
      divisao: op.divisao ?? musica.divisao ?? 60,
      estiloNome: op.estiloNome ?? 'do',
    }
    this.fila = plano.trechos.map((trecho) => ({ trecho, passos: this.passosDe(trecho), tentativa: 1, reforco: 0 })).filter((e) => e.passos.length)
    if (!this.fila.length) this.terminou = true
  }

  private passosDe(t: Trecho): Passo[] {
    return gerarPassos(this.musica, t.nivel, { maos: t.maos, inicio: t.inicio, fim: t.fim, soMelodia: t.soMelodia })
  }

  /** ms por batida já com a velocidade */
  get msPorBatida(): number {
    return 60000 / (this.musica.bpm * this.op.velocidade)
  }

  /** Começa a contar (no modo ritmo: o instante da 1ª batida depois da contagem). */
  iniciar(t: number): void {
    this.inicioEm = t
    const p = this.passoAtual
    this.referenciaRitmo = p ? { t, batida: p.t } : null
  }

  get trechoAtual(): Trecho | undefined {
    return this.fila[this.iTrecho]?.trecho
  }
  get indiceTrecho(): number {
    return this.iTrecho
  }
  get totalTrechos(): number {
    return this.fila.length
  }
  get tentativa(): number {
    return this.fila[this.iTrecho]?.tentativa ?? 1
  }
  get passosDoTrecho(): Passo[] {
    return this.fila[this.iTrecho]?.passos ?? []
  }
  get indicePasso(): number {
    return this.iPasso
  }
  get passoAtual(): Passo | undefined {
    return this.fila[this.iTrecho]?.passos[this.iPasso]
  }
  proximos(n: number): Passo[] {
    return this.passosDoTrecho.slice(this.iPasso + 1, this.iPasso + 1 + n)
  }
  /** notas do passo atual já pressionadas (acorde parcial) */
  get notasJaPressionadas(): number[] {
    return [...this.pressionadas.keys()]
  }
  /** progresso geral 0–1 */
  get progresso(): number {
    const total = this.fila.reduce((s, e) => s + e.passos.length, 0)
    const feitos = this.fila.slice(0, this.iTrecho).reduce((s, e) => s + e.passos.length, 0) + this.iPasso
    return total ? Math.min(1, feitos / total) : 1
  }

  private ladoErrado(midi: number): boolean {
    const maos = this.trechoAtual?.maos
    if (maos === 'direita') return midi < this.op.divisao
    if (maos === 'esquerda') return midi >= this.op.divisao
    return false
  }

  noteOff(midi: number): void {
    this.seguradas.delete(midi)
  }

  noteOn(midi: number, t: number): Retorno {
    if (this.inicioEm === null) this.iniciar(t)
    this.seguradas.add(midi)
    const p = this.passoAtual
    if (this.terminou || !p) return { tipo: 'ignorada', midi }
    const esperadas = p.notas.map((n) => n.midi)

    if (!esperadas.includes(midi)) {
      // eco/repique da nota anterior (microfone) ou mão que não está sendo treinada
      if (this.ultimoPassoNotas.includes(midi) && t - this.ultimoAcertoEm < 120) return { tipo: 'ignorada', midi }
      if (this.ladoErrado(midi)) return { tipo: 'ignorada', midi, mensagem: 'Nota da outra mão — ignorada neste modo.' }
      this.erros.push({ trecho: this.iTrecho, passo: this.iPasso, compasso: p.compasso, secao: p.secao, tocada: midi, esperadas, t })
      this.errosTrechoAtual++
      this.errosPorSecaoNoTrecho.set(p.secao, (this.errosPorSecaoNoTrecho.get(p.secao) ?? 0) + 1)
      return { tipo: 'erro', midi, mensagem: explicarErro(midi, esperadas, this.op.estiloNome) }
    }

    this.pressionadas.set(midi, t)
    const todas = esperadas.every((m) => this.pressionadas.has(m) && this.seguradas.has(m))
    if (!todas) {
      const faltam = esperadas.filter((m) => !this.pressionadas.has(m) || !this.seguradas.has(m))
      return { tipo: 'parcial', midi, mensagem: `Falta: ${faltam.map((m) => nome(m, this.op.estiloNome)).join(', ')}` }
    }
    const tempos = esperadas.map((m) => this.pressionadas.get(m)!)
    const ini = Math.min(...tempos)
    if (esperadas.length > 1 && Math.max(...tempos) - ini > this.op.janelaAcordeMs) {
      this.pressionadas.clear()
      return { tipo: 'acorde_separado', midi, mensagem: 'Quase! Aperte as notas do acorde juntas, ao mesmo tempo.' }
    }
    return this.concluirPasso(p, ini, t)
  }

  private concluirPasso(p: Passo, inicioNota: number, t: number): Retorno {
    this.corretas += p.notas.length
    let julgamento: Julgamento | undefined
    let desvioMs: number | undefined
    if (this.op.ritmo && this.referenciaRitmo) {
      const esperado = this.referenciaRitmo.t + (p.t - this.referenciaRitmo.batida) * this.msPorBatida
      desvioMs = Math.round(inicioNota - esperado)
      const mpb = this.msPorBatida
      const perf = Math.max(60, 0.12 * mpb)
      const bom = Math.max(130, 0.28 * mpb)
      const a = Math.abs(desvioMs)
      julgamento = a <= perf ? 'perfeito' : a <= bom ? 'bom' : desvioMs < 0 ? 'adiantado' : 'atrasado'
      this.julgamentos.push(julgamento)
      // a próxima nota é medida a partir desta (não acumula atraso)
      this.referenciaRitmo = { t: inicioNota, batida: p.t }
    }
    this.ultimoPassoNotas = p.notas.map((n) => n.midi)
    this.ultimoAcertoEm = t
    this.pressionadas.clear()
    this.iPasso++
    const e = this.fila[this.iTrecho]
    if (this.iPasso < e.passos.length) return { tipo: 'acerto', julgamento, desvioMs }
    return this.fimDoTrecho(t, julgamento, desvioMs)
  }

  private fimDoTrecho(t: number, julgamento?: Julgamento, desvioMs?: number): Retorno {
    const e = this.fila[this.iTrecho]
    let repeticao: string | undefined
    if (e.trecho.repetirAteAcertar && this.errosTrechoAtual > 0 && e.tentativa < 5) {
      this.fila.splice(this.iTrecho + 1, 0, { ...e, tentativa: e.tentativa + 1 })
      repeticao = `Vamos de novo até sair sem erros (tentativa ${e.tentativa + 1}).`
      this.trechosRepetidos++
    } else if (this.op.repetirTrechosDificeis) {
      const novos: EstadoTrecho[] = []
      for (const [sec, n] of [...this.errosPorSecaoNoTrecho.entries()].sort((a, b) => a[0] - b[0])) {
        if (n < 3) continue
        const chave = `${e.trecho.maos}:${sec}`
        const feitos = this.reforcos.get(chave) ?? 0
        if (feitos >= 2) continue
        const s = this.musica.secoes[sec]
        const trecho: Trecho = {
          ...e.trecho,
          repetirAteAcertar: false,
          rotulo: `Reforço: ${s.nome} (${n} erros)`,
          inicio: Math.max(s.inicio, e.trecho.inicio),
          fim: Math.min(s.fim, e.trecho.fim),
        }
        const passos = this.passosDe(trecho)
        if (!passos.length) continue
        this.reforcos.set(chave, feitos + 1)
        novos.push({ trecho, passos, tentativa: 1, reforco: feitos + 1 })
      }
      if (novos.length) {
        this.fila.splice(this.iTrecho + 1, 0, ...novos)
        this.trechosRepetidos += novos.length
        repeticao = `Vamos reforçar: ${novos.map((x) => x.trecho.rotulo.replace('Reforço: ', '')).join(', ')}.`
      }
    }
    this.errosTrechoAtual = 0
    this.errosPorSecaoNoTrecho.clear()
    this.iTrecho++
    this.iPasso = 0
    this.ultimoPassoNotas = []
    if (this.iTrecho >= this.fila.length) {
      if (this.op.loop) {
        this.iTrecho = 0
        this.referenciaRitmo = null
        return { tipo: 'fim_trecho', julgamento, desvioMs, repeticao: 'Repetindo o trecho (loop).' }
      }
      this.terminou = true
      this.fimEm = t
      return { tipo: 'fim', julgamento, desvioMs, repeticao }
    }
    // próximo trecho: o ritmo recomeça (a tela faz nova contagem)
    this.referenciaRitmo = null
    return { tipo: 'fim_trecho', julgamento, desvioMs, repeticao }
  }

  /** Recomeça o ritmo a partir de t (depois de uma contagem do próximo trecho). */
  recomecarRitmo(t: number): void {
    const p = this.passoAtual
    this.referenciaRitmo = p ? { t, batida: p.t } : null
  }

  /** Volta ao início do trecho atual (botão Repetir). */
  repetirTrecho(): void {
    this.iPasso = 0
    this.pressionadas.clear()
    this.errosTrechoAtual = 0
    this.errosPorSecaoNoTrecho.clear()
    this.referenciaRitmo = null
  }

  /** Termina agora (botão Parar e avaliar). */
  encerrar(t: number): void {
    this.terminou = true
    this.fimEm = t
  }

  resultado(agora?: number): Resultado {
    const tempoMs = Math.max(0, (this.fimEm ?? agora ?? this.inicioEm ?? 0) - (this.inicioEm ?? 0))
    const erradas = this.erros.length
    const precisaoNotas = this.corretas + erradas ? Math.round((100 * this.corretas) / (this.corretas + erradas)) : 0
    let ritmo: Resultado['ritmo'] = null
    if (this.op.ritmo && this.julgamentos.length) {
      const c = { perfeito: 0, bom: 0, adiantado: 0, atrasado: 0 }
      for (const j of this.julgamentos) c[j]++
      const precisao = Math.round((100 * (c.perfeito + 0.7 * c.bom)) / this.julgamentos.length)
      ritmo = { ...c, precisao }
    }
    const pontuacao = ritmo ? Math.round(0.7 * precisaoNotas + 0.3 * ritmo.precisao) : precisaoNotas
    const errosPorCompasso: Record<number, number> = {}
    const errosPorNota: Record<number, number> = {}
    for (const e of this.erros) {
      errosPorCompasso[e.compasso] = (errosPorCompasso[e.compasso] ?? 0) + 1
      const alvo = e.esperadas.reduce((a, b) => (Math.abs(b - e.tocada) < Math.abs(a - e.tocada) ? b : a))
      errosPorNota[alvo] = (errosPorNota[alvo] ?? 0) + 1
    }
    const est = this.op.estiloNome
    const pontos: string[] = []
    const comp = Object.entries(errosPorCompasso).sort((a, b) => b[1] - a[1]).slice(0, 3)
    for (const [c, n] of comp) {
      const errosC = this.erros.filter((e) => e.compasso === Number(c))
      const sec = this.musica.secoes[errosC[0].secao]?.nome
      const tr = new Map<string, number>()
      for (const e of errosC) {
        const alvo = e.esperadas.reduce((a, b) => (Math.abs(b - e.tocada) < Math.abs(a - e.tocada) ? b : a))
        const k = `${nome(alvo, est)} (tocou ${nome(e.tocada, est)})`
        tr.set(k, (tr.get(k) ?? 0) + 1)
      }
      const princ = [...tr.entries()].sort((a, b) => b[1] - a[1])[0][0]
      pontos.push(`Compasso ${c}${sec ? ` (${sec})` : ''}: ${n} ${n === 1 ? 'erro' : 'erros'} — atenção em ${princ}.`)
    }
    const notasDificeis = Object.entries(errosPorNota).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3)
    if (notasDificeis.length) pontos.push(`Notas que mais confundiram: ${notasDificeis.map(([m, n]) => `${nome(Number(m), est)} (${n}×)`).join(', ')}.`)
    if (ritmo) {
      if (ritmo.adiantado > ritmo.atrasado && ritmo.adiantado >= 3) pontos.push(`Você adiantou ${ritmo.adiantado} notas: espere a batida do metrônomo.`)
      else if (ritmo.atrasado >= 3) pontos.push(`Você atrasou ${ritmo.atrasado} notas: tente diminuir a velocidade e manter o pulso.`)
    }
    if (!pontos.length) pontos.push(erradas === 0 ? 'Nenhum erro! Tente o próximo nível ou ative o modo ritmo.' : 'Continue praticando devagar.')
    return {
      corretas: this.corretas,
      erradas,
      passos: this.fila.reduce((s, e) => s + e.passos.length, 0),
      ritmo,
      tempoMs,
      precisaoNotas,
      pontuacao,
      pontosAMelhorar: pontos,
      errosPorCompasso,
      errosPorNota,
      trechosRepetidos: this.trechosRepetidos,
    }
  }
}
