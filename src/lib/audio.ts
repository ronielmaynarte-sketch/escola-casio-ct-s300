// Síntese simples de piano com Web Audio (sem arquivos de áudio, sem APIs pagas).

let ctx: AudioContext | null = null
let master: GainNode | null = null

// Quando o próprio app está tocando (demonstração, metrônomo, teclado da tela), o microfone
// deve parar de ouvir para não reconhecer o som do celular como se fosse o aluno.
let silencioAte = 0
const agoraMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

/** true enquanto o app está emitindo som (mais uma pequena cauda). */
export function appTocandoSom(): boolean {
  return ativas.size > 0 || agoraMs() < silencioAte
}

/** Contexto de áudio compartilhado (o microfone usa o mesmo, importante no iPhone). */
export function obterContexto(): AudioContext | null {
  return contexto()
}

function contexto(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.35
    const comp = ctx.createDynamicsCompressor()
    master.connect(comp)
    comp.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function frequencia(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

interface VozAtiva {
  gain: GainNode
  oscs: OscillatorNode[]
}

const ativas = new Map<number, VozAtiva>()

export function tocarNota(midi: number, intensidade = 0.9): void {
  const ac = contexto()
  if (!ac || !master) return
  silencioAte = Math.max(silencioAte, agoraMs() + 400)
  pararNota(midi, 0.03)
  const t = ac.currentTime
  const f = frequencia(midi)
  const gain = ac.createGain()
  // notas graves soam um pouco mais longas
  const decaimento = 1.2 + Math.max(0, (72 - midi) / 24)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.5 * intensidade, t + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.18 * intensidade, t + 0.25)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + decaimento + 1.5)

  const filtro = ac.createBiquadFilter()
  filtro.type = 'lowpass'
  filtro.frequency.setValueAtTime(Math.min(12000, f * 8), t)
  filtro.frequency.exponentialRampToValueAtTime(Math.max(400, f * 2), t + 0.8)
  filtro.connect(gain)
  gain.connect(master)

  const parciais: Array<[OscillatorType, number, number]> = [
    ['triangle', 1, 0.7],
    ['sine', 2, 0.25],
    ['sine', 3, 0.08],
  ]
  const oscs = parciais.map(([tipo, mult, vol]) => {
    const o = ac.createOscillator()
    o.type = tipo
    o.frequency.value = f * mult
    const g = ac.createGain()
    g.gain.value = vol
    o.connect(g)
    g.connect(filtro)
    o.start(t)
    o.stop(t + decaimento + 1.6)
    return o
  })
  ativas.set(midi, { gain, oscs })
}

export function soltarNota(midi: number): void {
  if (ativas.has(midi)) silencioAte = Math.max(silencioAte, agoraMs() + 450)
  pararNota(midi, 0.35)
}

/** Clique do metrônomo (forte = primeiro tempo do compasso). */
export function tocarClique(forte: boolean, volume = 0.6): void {
  const ac = contexto()
  if (!ac || !master || volume <= 0) return
  silencioAte = Math.max(silencioAte, agoraMs() + 90)
  const t = ac.currentTime
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = 'square'
  o.frequency.value = forte ? 1760 : 1175
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.4 * volume, t + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
  o.connect(g)
  g.connect(master)
  o.start(t)
  o.stop(t + 0.06)
}

function pararNota(midi: number, release: number): void {
  const v = ativas.get(midi)
  if (!v || !ctx) return
  const t = ctx.currentTime
  try {
    v.gain.gain.cancelScheduledValues(t)
    v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), t)
    v.gain.gain.exponentialRampToValueAtTime(0.0001, t + release)
    v.oscs.forEach((o) => o.stop(t + release + 0.05))
  } catch {
    // oscilador já parado
  }
  ativas.delete(midi)
}

const NOMES = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si']
const CIFRAS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function nomeNota(midi: number): string {
  return NOMES[midi % 12]
}
export function cifraNota(midi: number, oitava = true): string {
  return CIFRAS[midi % 12] + (oitava ? String(Math.floor(midi / 12) - 1) : '')
}
export function ehPreta(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(midi % 12)
}
