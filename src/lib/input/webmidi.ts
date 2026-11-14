// Entrada por Web MIDI (Chrome no Android/computador com o CT-S300 ligado por cabo USB).
// O Safari do iPhone NÃO tem Web MIDI.

export interface MensagemNota {
  tipo: 'on' | 'off'
  midi: number
  velocidade: number
  canal: number
}

/** Converte bytes MIDI em evento de nota (note-on com velocidade 0 = note-off). Puro, testável. */
export function lerMensagemMidi(dados: ArrayLike<number>): MensagemNota | null {
  if (!dados || dados.length < 3) return null
  const status = dados[0] & 0xf0
  const canal = dados[0] & 0x0f
  const midi = dados[1] & 0x7f
  const vel = dados[2] & 0x7f
  if (status === 0x90 && vel > 0) return { tipo: 'on', midi, velocidade: vel, canal }
  if (status === 0x80 || (status === 0x90 && vel === 0)) return { tipo: 'off', midi, velocidade: 0, canal }
  return null
}

export function webMidiSuportado(): boolean {
  return typeof navigator !== 'undefined' && typeof (navigator as Navigator & { requestMIDIAccess?: unknown }).requestMIDIAccess === 'function'
}

type EntradaFisica = { name?: string | null; state?: string; onmidimessage: ((e: { data: Uint8Array }) => void) | null }
type Acesso = {
  inputs: { forEach(cb: (i: EntradaFisica) => void): void }
  onstatechange: ((e: unknown) => void) | null
}

export class EntradaMidi {
  private acesso: Acesso | null = null
  dispositivos: string[] = []

  constructor(
    private aoNota: (m: MensagemNota) => void,
    private aoMudar: () => void,
  ) {}

  async iniciar(): Promise<void> {
    if (!webMidiSuportado()) throw new Error('nao-suportado')
    const nav = navigator as unknown as { requestMIDIAccess: (o?: { sysex: boolean }) => Promise<Acesso> }
    const acesso = await nav.requestMIDIAccess({ sysex: false })
    this.acesso = acesso
    this.ligar()
    acesso.onstatechange = () => {
      this.ligar()
      this.aoMudar()
    }
    this.aoMudar()
  }

  private ligar(): void {
    if (!this.acesso) return
    const nomes: string[] = []
    this.acesso.inputs.forEach((inp) => {
      if (inp.state && inp.state !== 'connected') return
      nomes.push(inp.name || 'Teclado MIDI')
      inp.onmidimessage = (e) => {
        const m = lerMensagemMidi(e.data)
        if (m) this.aoNota(m)
      }
    })
    this.dispositivos = nomes
  }

  parar(): void {
    if (!this.acesso) return
    this.acesso.inputs.forEach((inp) => (inp.onmidimessage = null))
    this.acesso.onstatechange = null
    this.acesso = null
    this.dispositivos = []
  }
}
