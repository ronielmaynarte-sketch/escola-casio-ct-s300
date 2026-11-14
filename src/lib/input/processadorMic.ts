// Processador do microfone (puro: recebe amostras, devolve eventos de nota).
// - Portão de ruído (calibrado) e detecção de ataque (subida de energia) para notas repetidas.
// - Uma nota: McLeod/NSDF com estabilização em 2 análises e proteção contra erro de oitava.
// - Acorde (quando o passo atual espera 2+ notas): verificação espectral das notas esperadas (experimental).

import { analisarAcorde } from './acordes'
import { espectroMagnitude } from './fft'
import { clarezaEm, detectarPitch, rms } from './pitch'

export interface EventoMic {
  tipo: 'on' | 'off'
  midi: number
}

export interface OpcoesProcessador {
  /** RMS do ruído ambiente medido na calibração */
  ruido?: number | null
  /** 0.5 (menos sensível) – 2 (mais sensível) */
  sensibilidade?: number
  /** clareza mínima para aceitar uma nota */
  clarezaMin?: number
}

type Estado = 'silencio' | 'pendente' | 'soando'

const midiDe = (f: number) => 69 + 12 * Math.log2(f / 440)
const freqDe = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

export class ProcessadorMic {
  private estado: Estado = 'silencio'
  private historico: { t: number; v: number; hf: number }[] = []
  private ultimoAtaque = -Infinity
  private ataqueEm = 0
  private candidatoAnterior: number | null = null
  private soando: number[] = []
  private picoRms = 0
  private espectros: Float64Array[] = []
  private modoAcorde = false
  private trocaCont = 0
  private trocaNota: number | null = null
  private quadros = 0
  esperadas: number[] = []
  mudo = false
  /** último nível (para o medidor na tela) */
  nivel = 0
  ultimaFreq = 0
  ultimaClareza = 0

  constructor(
    readonly sr: number,
    public op: OpcoesProcessador = {},
  ) {}

  get portao(): number {
    const base = Math.max(0.0035, 3 * (this.op.ruido ?? 0.001))
    return base / (this.op.sensibilidade ?? 1)
  }

  setEsperadas(n: number[]): void {
    this.esperadas = [...n]
  }

  /** Silencia (ex.: enquanto o app toca a demonstração). Solta as notas e descarta análises pendentes. */
  setMudo(m: boolean): EventoMic[] {
    if (m === this.mudo) return []
    this.mudo = m
    const ev = m ? this.soltarTudo() : []
    this.estado = 'silencio'
    this.historico = []
    return ev
  }

  private soltarTudo(): EventoMic[] {
    const ev = this.soando.map((midi) => ({ tipo: 'off' as const, midi }))
    this.soando = []
    return ev
  }

  /**
   * @param janela últimas amostras (idealmente 4096 ou mais)
   * @param t tempo atual em ms
   */
  processar(janela: Float32Array, t: number): EventoMic[] {
    const ev: EventoMic[] = []
    const n = janela.length
    const rec = rms(janela, Math.max(0, n - 1024), n)
    this.nivel = rec
    if (this.mudo) return ev
    // energia de alta frequência (derivada): o "clique" do ataque aparece mesmo quando a nota
    // anterior (igual) ainda está soando
    let hfS = 0
    for (let i = Math.max(1, n - 512); i < n; i++) {
      const d = janela[i] - janela[i - 1]
      hfS += d * d
    }
    const hf = Math.sqrt(hfS / 512)
    const anterior = this.historico.length ? this.historico[this.historico.length - 1].v : 0
    // mínimos dos ~50 ms anteriores (sem o quadro atual)
    const minRecente = this.historico.length ? Math.min(...this.historico.map((h) => h.v)) : 0
    const minHf = this.historico.length ? Math.min(...this.historico.map((h) => h.hf)) : 0
    this.historico.push({ t, v: rec, hf })
    while (this.historico.length && t - this.historico[0].t > 50) this.historico.shift()
    const portao = this.portao
    const subindo = rec > 1.2 * anterior
    const porEnergia = subindo && (this.estado === 'silencio' ? rec > portao * 1.2 : rec > 1.35 * minRecente)
    const porClique = this.estado !== 'silencio' && minHf > 0 && hf > 2.2 * minHf && rec > 0.9 * anterior
    const ataque = rec > portao && t - this.ultimoAtaque > 80 && (porEnergia || porClique)

    if (ataque) {
      ev.push(...this.soltarTudo())
      this.estado = 'pendente'
      this.ultimoAtaque = t
      this.ataqueEm = t
      this.candidatoAnterior = null
      this.espectros = []
      this.picoRms = rec
      this.modoAcorde = this.esperadas.length >= 2
      return ev
    }

    if (this.estado === 'pendente') {
      this.picoRms = Math.max(this.picoRms, rec)
      const decorrido = t - this.ataqueEm
      if (this.modoAcorde) ev.push(...this.analisarAcordePendente(janela, decorrido))
      else ev.push(...this.analisarNotaPendente(janela, decorrido))
      return ev
    }

    if (this.estado === 'soando') {
      this.picoRms = Math.max(this.picoRms, rec)
      if (rec < portao * 0.8 || rec < this.picoRms * 0.04) {
        ev.push(...this.soltarTudo())
        this.estado = 'silencio'
        return ev
      }
      // troca de altura sem ataque claro (nota tocada suave sobre a anterior)
      if (!this.modoAcorde && this.soando.length === 1 && ++this.quadros % 3 === 0 && n >= 2048) {
        const r = detectarPitch(janela.subarray(n - Math.min(n, 4096)), this.sr)
        const m = r.freq ? Math.round(midiDe(r.freq)) : null
        if (m !== null && r.clareza >= 0.92 && m !== this.soando[0] && Math.abs(m - this.soando[0]) !== 12) {
          if (this.trocaNota === m) this.trocaCont++
          else {
            this.trocaNota = m
            this.trocaCont = 1
          }
          if (this.trocaCont >= 3 && m >= 36 && m <= 96) {
            ev.push(...this.soltarTudo())
            ev.push({ tipo: 'on', midi: m })
            this.soando = [m]
            this.trocaCont = 0
          }
        } else this.trocaCont = 0
      }
    }
    return ev
  }

  private tamanhoJanela(decorrido: number, disponivel: number): number {
    const amostras = (decorrido / 1000) * this.sr + 400
    for (const w of [4096, 2048]) if (amostras >= w && disponivel >= w) return w
    return 0
  }

  private analisarNotaPendente(janela: Float32Array, decorrido: number): EventoMic[] {
    if (decorrido < 30) return []
    if (decorrido > 260) {
      this.estado = 'soando' // som sem altura definida (batida, ruído): ignora
      return []
    }
    const W = this.tamanhoJanela(decorrido, janela.length)
    if (!W) return []
    const x = janela.subarray(janela.length - W)
    const r = detectarPitch(x, this.sr)
    this.ultimaFreq = r.freq
    this.ultimaClareza = r.clareza
    if (!r.freq) return []
    const exato = midiDe(r.freq)
    let m = Math.round(exato)
    const desvio = Math.abs(exato - m)
    const cmin = this.op.clarezaMin ?? 0.8
    if (r.clareza < cmin || desvio > 0.4 || m < 36 || m > 96) {
      this.candidatoAnterior = null
      return []
    }
    if (m < 48 && W < 4096) return [] // graves precisam de janela longa
    // proteção de oitava guiada pela nota esperada: se a esperada é a mesma nota numa oitava vizinha
    // e o sinal também é periódico nela, ficamos com a esperada.
    for (const e of this.esperadas) {
      if (e !== m && (e - m) % 12 === 0 && Math.abs(e - m) <= 12 && !this.esperadas.includes(m)) {
        const c = clarezaEm(x, this.sr, freqDe(e))
        if (c >= 0.9 * r.clareza) m = e
      }
    }
    const confirmado = this.candidatoAnterior === m || (r.clareza >= 0.95 && W >= 4096)
    this.candidatoAnterior = m
    if (!confirmado) return []
    this.estado = 'soando'
    this.soando = [m]
    this.quadros = 0
    return [{ tipo: 'on', midi: m }]
  }

  private analisarAcordePendente(janela: Float32Array, decorrido: number): EventoMic[] {
    if (decorrido < 45) return []
    const W = this.tamanhoJanela(decorrido, janela.length)
    if (W) this.espectros.push(espectroMagnitude(janela.subarray(janela.length - W), 8192))
    if (decorrido < 150 && this.espectros.length < 3) return []
    this.estado = 'soando'
    if (!this.espectros.length) return []
    const media = new Float64Array(this.espectros[0].length)
    for (const s of this.espectros) for (let i = 0; i < s.length; i++) media[i] += s[i] / this.espectros.length
    const a = analisarAcorde(media, this.sr, 8192, this.esperadas)
    const notas = [...a.presentes]
    if (a.errada !== null) notas.push(a.errada)
    if (!notas.length) {
      // nenhuma esperada: tenta dizer qual nota (única) foi tocada
      const r = detectarPitch(janela.subarray(janela.length - Math.min(janela.length, 4096)), this.sr)
      if (r.freq && r.clareza >= 0.85) {
        const m = Math.round(midiDe(r.freq))
        if (m >= 36 && m <= 96) notas.push(m)
      }
    }
    this.soando = notas
    return notas.map((midi) => ({ tipo: 'on' as const, midi }))
  }
}
