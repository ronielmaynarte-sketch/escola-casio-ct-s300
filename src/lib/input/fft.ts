// FFT radix-2 iterativa (in-place), sem dependências.

export function proximaPotencia2(n: number): number {
  let p = 1
  while (p < n) p <<= 1
  return p
}

const cacheTw = new Map<number, { cos: Float64Array; sin: Float64Array; rev: Uint32Array }>()

function tabelas(n: number) {
  let t = cacheTw.get(n)
  if (t) return t
  const cos = new Float64Array(n / 2)
  const sin = new Float64Array(n / 2)
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n)
    sin[i] = -Math.sin((2 * Math.PI * i) / n)
  }
  const bits = Math.log2(n)
  const rev = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    let r = 0
    for (let b = 0; b < bits; b++) r = (r << 1) | ((i >> b) & 1)
    rev[i] = r
  }
  t = { cos, sin, rev }
  cacheTw.set(n, t)
  return t
}

/** FFT in-place. `inversa` aplica a conjugação e divide por n. */
export function fft(re: Float64Array, im: Float64Array, inversa = false): void {
  const n = re.length
  const { cos, sin, rev } = tabelas(n)
  for (let i = 0; i < n; i++) {
    const j = rev[i]
    if (j > i) {
      let tmp = re[i]
      re[i] = re[j]
      re[j] = tmp
      tmp = im[i]
      im[i] = im[j]
      im[j] = tmp
    }
  }
  const sinal = inversa ? -1 : 1
  for (let tam = 2; tam <= n; tam <<= 1) {
    const meio = tam >> 1
    const passo = n / tam
    for (let i = 0; i < n; i += tam) {
      for (let j = 0, k = 0; j < meio; j++, k += passo) {
        const wr = cos[k]
        const wi = sinal * sin[k]
        const a = i + j
        const b = a + meio
        const xr = re[b] * wr - im[b] * wi
        const xi = re[b] * wi + im[b] * wr
        re[b] = re[a] - xr
        im[b] = im[a] - xi
        re[a] += xr
        im[a] += xi
      }
    }
  }
  if (inversa) {
    for (let i = 0; i < n; i++) {
      re[i] /= n
      im[i] /= n
    }
  }
}

/** Espectro de magnitude com janela de Hann (tamanho n potência de 2; zero-padding se o quadro for menor). */
export function espectroMagnitude(quadro: ArrayLike<number>, n: number): Float64Array {
  const re = new Float64Array(n)
  const im = new Float64Array(n)
  const L = Math.min(quadro.length, n)
  const off = quadro.length - L
  for (let i = 0; i < L; i++) re[i] = quadro[off + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (L - 1)))
  fft(re, im)
  const mag = new Float64Array(n / 2)
  for (let i = 0; i < n / 2; i++) mag[i] = Math.hypot(re[i], im[i])
  return mag
}
