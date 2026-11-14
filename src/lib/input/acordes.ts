// Verificação de acordes pelo microfone (EXPERIMENTAL).
// Não é transcrição polifônica geral: conferimos se as notas ESPERADAS estão presentes
// (pico na fundamental + harmônicos) e se há uma nota forte que não deveria estar ali.

const f0 = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

export interface AnaliseAcorde {
  presentes: number[]
  ausentes: number[]
  errada: number | null
  /** força relativa de cada candidato (0–1) */
  forca: Record<number, number>
}

/**
 * Pico espectral perto de f: precisa ser um máximo local de verdade, com frequência (interpolada)
 * dentro da tolerância. Vazamento de uma nota vizinha (borda de outro pico) não conta.
 */
function pico(mag: Float64Array, binHz: number, f: number, tolSemitons: number): number {
  const lo = Math.max(1, Math.floor((f * Math.pow(2, -tolSemitons / 12)) / binHz) - 1)
  const hi = Math.min(mag.length - 2, Math.ceil((f * Math.pow(2, tolSemitons / 12)) / binHz) + 1)
  let m = 0
  for (let i = lo; i <= hi; i++) {
    if (mag[i] < mag[i - 1] || mag[i] < mag[i + 1]) continue
    const a = mag[i - 1]
    const b = mag[i]
    const c = mag[i + 1]
    const d = a - 2 * b + c
    const dx = d === 0 ? 0 : (0.5 * (a - c)) / d
    const fp = (i + dx) * binHz
    if (Math.abs(12 * Math.log2(fp / f)) > tolSemitons) continue
    if (b > m) m = b
  }
  return m
}

function piso(mag: Float64Array, binHz: number): number {
  const lo = Math.floor(60 / binHz)
  const hi = Math.min(mag.length - 1, Math.floor(5000 / binHz))
  const v = Array.from(mag.subarray(lo, hi)).sort((a, b) => a - b)
  return v[Math.floor(v.length / 2)] || 1e-9
}

/** Evidência de uma nota: fundamental (ou 2º harmônico, se a fundamental for fraca) + harmônicos. */
export function evidenciaNota(mag: Float64Array, sr: number, nfft: number, midi: number): { h1: number; h2: number; soma: number } {
  const binHz = sr / nfft
  const f = f0(midi)
  const tol = Math.min(0.5, Math.max(0.3, ((0.6 * binHz) / f) * 17.3)) // ±0,3–0,5 semitom
  const h1 = pico(mag, binHz, f, tol)
  const h2 = 2 * f < sr / 2 ? pico(mag, binHz, 2 * f, Math.max(0.3, tol / 2)) : 0
  let soma = h1 + 0.7 * h2
  for (let h = 3; h <= 5; h++) if (h * f < 5000) soma += (0.5 / h) * pico(mag, binHz, h * f, 0.45)
  return { h1, h2, soma }
}

/** Se a frequência fundamental de `n` coincide com um harmônico de alguma nota de `base`. */
function ehHarmonicoDe(n: number, base: number[]): boolean {
  const fn = f0(n)
  for (const b of base) {
    if (b === n) return true
    const fb = f0(b)
    for (let h = 1; h <= 10; h++) {
      const tol = h >= 5 ? 0.6 : 0.4
      if (Math.abs(12 * Math.log2(fn / (h * fb))) < tol) return true
    }
  }
  return false
}

export function analisarAcorde(mag: Float64Array, sr: number, nfft: number, candidatos: number[]): AnaliseAcorde {
  const binHz = sr / nfft
  const ruido = piso(mag, binHz)
  const ev = new Map<number, { h1: number; h2: number; soma: number }>()
  for (const c of candidatos) ev.set(c, evidenciaNota(mag, sr, nfft, c))
  const maxSoma = Math.max(1e-12, ...[...ev.values()].map((e) => e.soma))
  const maxH = Math.max(1e-12, ...[...ev.values()].map((e) => Math.max(e.h1, e.h2)))
  const presentes: number[] = []
  const ausentes: number[] = []
  const forca: Record<number, number> = {}
  // do grave para o agudo: uma nota esperada que só aparece como harmônico de outra mais grave
  // precisa de fundamental própria bem forte.
  for (const c of [...candidatos].sort((a, b) => a - b)) {
    const e = ev.get(c)!
    const graves = presentes.filter((p) => p < c)
    // fundamental fraca (graves num alto-falante pequeno): aceita o 2º harmônico, se ele não for
    // explicado por outra nota mais grave já presente.
    const h2Proprio = c < 55 && !ehHarmonicoDe(c + 12, graves)
    const fund = h2Proprio && e.h1 < 0.35 * e.h2 ? Math.max(e.h1, 0.6 * e.h2) : e.h1
    forca[c] = e.soma / maxSoma
    const sobreposto = ehHarmonicoDe(c, graves)
    const ok = fund >= 10 * ruido && fund >= (sobreposto ? 0.45 : 0.12) * maxH && e.soma >= 0.15 * maxSoma
    ;(ok ? presentes : ausentes).push(c)
  }
  // nota errada forte
  let errada: number | null = null
  let melhor = 0
  const refFund = presentes.length ? Math.min(...presentes.map((p) => Math.max(ev.get(p)!.h1, 0.6 * ev.get(p)!.h2))) : maxH
  for (let n = 36; n <= 96; n++) {
    if (candidatos.includes(n)) continue
    if (ehHarmonicoDe(n, presentes.length ? presentes : candidatos)) continue
    const e = evidenciaNota(mag, sr, nfft, n)
    // vizinho de uma nota esperada (vazamento espectral) não conta
    if (candidatos.some((c) => Math.abs(c - n) === 1) && e.h1 < 0.8 * refFund) continue
    if (e.h1 >= 12 * ruido && e.h1 >= 0.5 * refFund && e.h1 > melhor) {
      melhor = e.h1
      errada = n
    }
  }
  return { presentes, ausentes, errada, forca }
}
