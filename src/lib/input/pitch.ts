// Detecção de altura monofônica: McLeod Pitch Method (NSDF), com autocorrelação por FFT.
// Funções puras — testadas offline com sinais sintetizados (tests/unit/pitch.test.ts).

import { fft, proximaPotencia2 } from './fft'

export interface ResultadoPitch {
  /** Hz (0 se nada confiável) */
  freq: number
  /** 0–1: quão periódico é o sinal (confiança) */
  clareza: number
  rms: number
}

export interface OpcoesPitch {
  fmin?: number
  fmax?: number
  /** limiar relativo para escolher o primeiro pico (0.8–0.95) */
  k?: number
}

export function rms(x: ArrayLike<number>, inicio = 0, fim = x.length): number {
  let s = 0
  for (let i = inicio; i < fim; i++) s += x[i] * x[i]
  return Math.sqrt(s / Math.max(1, fim - inicio))
}

/** NSDF (função de diferença quadrada normalizada) de 0 a tauMax. */
export function nsdf(x: ArrayLike<number>, tauMax: number): Float64Array {
  const W = x.length
  const N = proximaPotencia2(2 * W)
  const re = new Float64Array(N)
  const im = new Float64Array(N)
  let media = 0
  for (let i = 0; i < W; i++) media += x[i]
  media /= W
  for (let i = 0; i < W; i++) re[i] = x[i] - media
  const sq = new Float64Array(W)
  for (let i = 0; i < W; i++) sq[i] = re[i] * re[i]
  fft(re, im)
  for (let i = 0; i < N; i++) {
    re[i] = re[i] * re[i] + im[i] * im[i]
    im[i] = 0
  }
  fft(re, im, true)
  const out = new Float64Array(tauMax + 1)
  let m = 0
  for (let i = 0; i < W; i++) m += 2 * sq[i]
  for (let tau = 0; tau <= tauMax && tau < W; tau++) {
    if (tau > 0) m -= sq[tau - 1] + sq[W - tau]
    out[tau] = m > 1e-12 ? (2 * re[tau]) / m : 0
  }
  return out
}

function parabola(y: Float64Array, i: number): { x: number; y: number } {
  if (i <= 0 || i >= y.length - 1) return { x: i, y: y[i] }
  const a = y[i - 1]
  const b = y[i]
  const c = y[i + 1]
  const d = a - 2 * b + c
  if (d === 0) return { x: i, y: b }
  const dx = (0.5 * (a - c)) / d
  return { x: i + dx, y: b - 0.25 * (a - c) * dx }
}

export interface PicoNsdf {
  tau: number
  valor: number
}

/** Máximos-chave da NSDF (um por trecho positivo, depois do primeiro cruzamento negativo). */
export function picosChave(n: Float64Array, tauMin: number): PicoNsdf[] {
  const picos: PicoNsdf[] = []
  let i = 1
  while (i < n.length && n[i] > 0) i++ // sai do lóbulo do tau=0
  while (i < n.length) {
    while (i < n.length && n[i] <= 0) i++
    let melhor = -1
    let im = -1
    while (i < n.length && n[i] > 0) {
      if (n[i] > melhor) {
        melhor = n[i]
        im = i
      }
      i++
    }
    if (im > 0 && im >= tauMin - 1) {
      const p = parabola(n, im)
      picos.push({ tau: p.x, valor: p.y })
    }
  }
  return picos
}

export function detectarPitch(x: ArrayLike<number>, sr: number, op: OpcoesPitch = {}): ResultadoPitch {
  const fmin = op.fmin ?? 58
  const fmax = op.fmax ?? 2300
  const k = op.k ?? 0.88
  const r = rms(x)
  if (r < 1e-5) return { freq: 0, clareza: 0, rms: r }
  const tauMax = Math.min(Math.floor(x.length / 2), Math.ceil(sr / fmin))
  const tauMin = Math.max(2, Math.floor(sr / fmax))
  const n = nsdf(x, tauMax)
  const picos = picosChave(n, tauMin).filter((p) => p.tau >= tauMin - 0.5 && p.tau <= tauMax)
  if (!picos.length) return { freq: 0, clareza: 0, rms: r }
  const max = Math.max(...picos.map((p) => p.valor))
  let escolhido = picos.find((p) => p.valor >= k * max)!
  // Proteção contra erro de oitava para cima: se existe um pico claramente mais forte em ~2×tau
  // (fundamental fraca, 2º harmônico dominante), a altura real é uma oitava abaixo.
  const dobro = picos.find((p) => Math.abs(p.tau - 2 * escolhido.tau) < Math.max(1.5, 0.03 * escolhido.tau))
  if (dobro && dobro.valor > escolhido.valor + 0.06) escolhido = dobro
  return { freq: sr / escolhido.tau, clareza: Math.max(0, Math.min(1, escolhido.valor)), rms: r }
}

/** Valor da NSDF perto de um período (para conferir uma nota esperada). */
export function clarezaEm(x: ArrayLike<number>, sr: number, freq: number): number {
  const tau = sr / freq
  const tauMax = Math.min(Math.floor(x.length / 2), Math.ceil(tau * 1.05) + 2)
  if (tau >= tauMax) return 0
  const n = nsdf(x, tauMax)
  let best = -1
  for (let t = Math.floor(tau * 0.97); t <= Math.ceil(tau * 1.03) && t < n.length; t++) best = Math.max(best, n[t])
  return best
}
