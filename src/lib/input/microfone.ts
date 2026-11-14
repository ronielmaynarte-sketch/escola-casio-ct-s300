// Microfone no navegador: getUserMedia + AnalyserNode, alimentando o ProcessadorMic.
// No iPhone precisa começar com um toque do usuário (regra do iOS).

import { appTocandoSom, obterContexto } from '../audio'
import { ProcessadorMic } from './processadorMic'
import type { EventoMic, OpcoesProcessador } from './processadorMic'
import { rms } from './pitch'

export type EstadoMic = 'desligado' | 'pedindo' | 'ouvindo' | 'negado' | 'sem-microfone' | 'inseguro' | 'erro'

export class EntradaMicrofone {
  private stream: MediaStream | null = null
  private fonte: MediaStreamAudioSourceNode | null = null
  private analisador: AnalyserNode | null = null
  private saida: GainNode | null = null
  private timer: number | null = null
  private buf: Float32Array<ArrayBuffer> = new Float32Array(4096)
  private bytes: Uint8Array<ArrayBuffer> = new Uint8Array(4096)
  proc: ProcessadorMic | null = null
  estado: EstadoMic = 'desligado'
  mudo = false

  constructor(
    private aoEvento: (e: EventoMic) => void,
    private aoMudar: () => void,
    public opcoes: OpcoesProcessador = {},
  ) {}

  async iniciar(): Promise<void> {
    if (this.estado === 'ouvindo') return
    if (!navigator.mediaDevices?.getUserMedia) {
      this.estado = window.isSecureContext ? 'erro' : 'inseguro'
      this.aoMudar()
      throw new Error(this.estado)
    }
    // o contexto precisa ser criado/retomado dentro do toque (iOS)
    const ac = obterContexto()
    if (!ac) {
      this.estado = 'erro'
      this.aoMudar()
      throw new Error('sem-webaudio')
    }
    this.estado = 'pedindo'
    this.aoMudar()
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
    } catch (e) {
      const nome = (e as { name?: string }).name
      this.estado = nome === 'NotAllowedError' || nome === 'SecurityError' ? 'negado' : nome === 'NotFoundError' ? 'sem-microfone' : 'erro'
      this.aoMudar()
      throw e
    }
    if (ac.state === 'suspended') await ac.resume().catch(() => {})
    this.fonte = ac.createMediaStreamSource(this.stream)
    this.analisador = ac.createAnalyser()
    this.analisador.fftSize = 4096
    this.analisador.smoothingTimeConstant = 0
    this.saida = ac.createGain()
    this.saida.gain.value = 0 // o WebKit só processa nós ligados ao destino
    this.fonte.connect(this.analisador)
    this.analisador.connect(this.saida)
    this.saida.connect(ac.destination)
    this.proc = new ProcessadorMic(ac.sampleRate, this.opcoes)
    this.buf = new Float32Array(this.analisador.fftSize)
    this.bytes = new Uint8Array(this.analisador.fftSize)
    this.estado = 'ouvindo'
    this.timer = window.setInterval(() => this.passo(), 20)
    this.aoMudar()
  }

  private ler(): Float32Array {
    const a = this.analisador!
    if (typeof a.getFloatTimeDomainData === 'function') a.getFloatTimeDomainData(this.buf)
    else {
      a.getByteTimeDomainData(this.bytes)
      for (let i = 0; i < this.bytes.length; i++) this.buf[i] = (this.bytes[i] - 128) / 128
    }
    return this.buf
  }

  private passo(): void {
    if (!this.analisador || !this.proc) return
    const mudo = appTocandoSom()
    if (mudo !== this.mudo) {
      this.mudo = mudo
      for (const e of this.proc.setMudo(mudo)) this.aoEvento(e)
      this.aoMudar()
    }
    const x = this.ler()
    for (const e of this.proc.processar(x, performance.now())) this.aoEvento(e)
  }

  /** Nível atual (RMS) para o medidor. */
  get nivel(): number {
    return this.proc?.nivel ?? 0
  }

  /** Mede o ruído ambiente por `ms` (o aluno fica em silêncio). */
  async medirRuido(ms = 1500): Promise<number> {
    if (!this.analisador) throw new Error('microfone desligado')
    const valores: number[] = []
    const fim = performance.now() + ms
    while (performance.now() < fim) {
      valores.push(rms(this.ler()))
      await new Promise((r) => setTimeout(r, 50))
    }
    valores.sort((a, b) => a - b)
    // percentil 80: ignora picos isolados
    return valores[Math.floor(valores.length * 0.8)] ?? 0.001
  }

  configurar(op: OpcoesProcessador): void {
    this.opcoes = { ...this.opcoes, ...op }
    if (this.proc) this.proc.op = this.opcoes
  }

  setEsperadas(n: number[]): void {
    this.proc?.setEsperadas(n)
  }

  parar(): void {
    if (this.timer !== null) window.clearInterval(this.timer)
    this.timer = null
    this.stream?.getTracks().forEach((t) => t.stop())
    try {
      this.fonte?.disconnect()
      this.analisador?.disconnect()
      this.saida?.disconnect()
    } catch {
      /* já desligado */
    }
    this.stream = null
    this.fonte = null
    this.analisador = null
    this.proc = null
    this.estado = 'desligado'
    this.aoMudar()
  }
}
