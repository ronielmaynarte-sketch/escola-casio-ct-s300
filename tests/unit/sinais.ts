// Sinais sintetizados para testar a detecção sem microfone.

export const SR = 44100

export function freq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/** Gerador pseudoaleatório determinístico (para os testes serem reproduzíveis). */
export function rng(seed = 1): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export interface OpcoesTom {
  dur?: number
  /** 'seno' | 'harmonicos' | 'piano' (inarmonicidade, decaimento, ruído do martelo) | 'alto-falante' (piano com graves cortados, como um alto-falante pequeno) */
  timbre?: 'seno' | 'harmonicos' | 'piano' | 'alto-falante'
  amp?: number
  /** desvio de afinação em cents */
  cents?: number
}

export function tom(midi: number, op: OpcoesTom = {}, r = rng(midi)): Float32Array {
  const dur = op.dur ?? 0.6
  const n = Math.floor(dur * SR)
  const out = new Float32Array(n)
  const f0 = freq(midi) * Math.pow(2, (op.cents ?? 0) / 1200)
  const amp = op.amp ?? 0.3
  const timbre = op.timbre ?? 'piano'
  const parciais: { f: number; a: number; tau: number; fase: number }[] = []
  const B = timbre === 'piano' || timbre === 'alto-falante' ? 0.00005 * Math.pow(2, (midi - 36) / 12) : 0
  const H = timbre === 'seno' ? 1 : 10
  for (let h = 1; h <= H; h++) {
    const f = h * f0 * Math.sqrt(1 + B * h * h)
    if (f > SR / 2.2) break
    let a = timbre === 'seno' ? 1 : 1 / Math.pow(h, timbre === 'harmonicos' ? 1 : 1.1)
    if (timbre === 'piano' && midi < 48 && h === 1) a *= 0.5 // fundamental mais fraca nos graves
    if (timbre === 'alto-falante') a *= Math.pow(f / (f + 180), 3) // corta graves (alto-falante pequeno / microfone do celular)
    const tau = timbre === 'seno' || timbre === 'harmonicos' ? 10 : (1.5 * Math.pow(2, -(midi - 48) / 24)) / Math.sqrt(h)
    parciais.push({ f, a, tau, fase: r() * Math.PI * 2 })
  }
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const ataque = Math.min(1, t / 0.004)
    let v = 0
    for (const p of parciais) v += p.a * Math.exp(-t / p.tau) * Math.sin(2 * Math.PI * p.f * t + p.fase)
    out[i] = amp * ataque * v
  }
  if (timbre === 'piano' || timbre === 'alto-falante') {
    // ruído do martelo nos primeiros 12 ms
    for (let i = 0; i < Math.min(n, 0.012 * SR); i++) out[i] += amp * 0.25 * (r() * 2 - 1) * (1 - i / (0.012 * SR))
  }
  // normaliza o pico
  let pico = 0
  for (let i = 0; i < n; i++) pico = Math.max(pico, Math.abs(out[i]))
  if (pico > 0) for (let i = 0; i < n; i++) out[i] *= amp / pico
  return out
}

export function somar(...sinais: Float32Array[]): Float32Array {
  const n = Math.max(...sinais.map((s) => s.length))
  const out = new Float32Array(n)
  for (const s of sinais) for (let i = 0; i < s.length; i++) out[i] += s[i]
  return out
}

export function ruido(n: number, amp: number, r = rng(99)): Float32Array {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = amp * (r() * 2 - 1)
  return out
}

export function silencio(seg: number): Float32Array {
  return new Float32Array(Math.floor(seg * SR))
}

export function concatenar(...sinais: Float32Array[]): Float32Array {
  const n = sinais.reduce((s, x) => s + x.length, 0)
  const out = new Float32Array(n)
  let o = 0
  for (const s of sinais) {
    out.set(s, o)
    o += s.length
  }
  return out
}

/** Grava WAV mono 16 bits (para o teste com microfone falso do Chromium). */
export function wav(sinal: Float32Array, sr = SR): Uint8Array {
  const n = sinal.length
  const buf = new DataView(new ArrayBuffer(44 + n * 2))
  const w = (o: number, s: string) => [...s].forEach((c, i) => buf.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF')
  buf.setUint32(4, 36 + n * 2, true)
  w(8, 'WAVE')
  w(12, 'fmt ')
  buf.setUint32(16, 16, true)
  buf.setUint16(20, 1, true)
  buf.setUint16(22, 1, true)
  buf.setUint32(24, sr, true)
  buf.setUint32(28, sr * 2, true)
  buf.setUint16(32, 2, true)
  buf.setUint16(34, 16, true)
  w(36, 'data')
  buf.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) buf.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sinal[i])) * 32767, true)
  return new Uint8Array(buf.buffer)
}
