// Notação de texto simples usada pelas músicas embutidas e pela importação de texto.
//
//   Nota:      E4  F#4  Bb3  (também: Mi4, Fa#4, Sib3, Do4 ...)  Dó central = C4 = Do4
//   Duração:   ":1" (uma batida), ":0.5", ":1.5", ":1/3" — vale para as próximas até mudar
//   Acorde:    [C3 E3 G3]:2
//   Pausa:     R:1  (ou "-" / "P")
//   Dedo:      E4/3:1  (dedo 3)   acorde com dedos: [C3/5 E3/3 G3/1]
//   Barras "|" são só para leitura e são ignoradas.

import type { Mao, NotaEv } from './tipos'

export class ErroNotacao extends Error {}

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const PT: Record<string, string> = { DO: 'C', RE: 'D', MI: 'E', FA: 'F', SOL: 'G', LA: 'A', SI: 'B' }

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Converte "C#4", "Eb3", "Do4", "Sol#3", "Fá5" em MIDI. */
export function notaParaMidi(txt: string): number {
  const s = semAcento(txt.trim())
  let m = /^(do|re|mi|fa|sol|la|si)([#b]?)(-?\d)$/i.exec(s)
  let letra: string
  let acid: string
  let oit: number
  if (m) {
    letra = PT[m[1].toUpperCase()]
    acid = m[2]
    oit = Number(m[3])
  } else {
    m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(s)
    if (!m) throw new ErroNotacao(`Nota inválida: "${txt}"`)
    letra = m[1].toUpperCase()
    acid = m[2]
    oit = Number(m[3])
  }
  const pc = PC[letra] + (acid === '#' ? 1 : acid === 'b' ? -1 : 0)
  return (oit + 1) * 12 + pc
}

function lerDuracao(txt: string): number {
  const t = txt.trim()
  const f = /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(t)
  const v = f ? Number(f[1]) / Number(f[2]) : Number(t)
  if (!Number.isFinite(v) || v <= 0) throw new ErroNotacao(`Duração inválida: "${txt}"`)
  return v
}

function lerNotaComDedo(txt: string): { midi: number; dedo?: number } {
  const [n, d] = txt.split('/')
  const midi = notaParaMidi(n)
  const dedo = d ? Number(d) : undefined
  if (dedo !== undefined && !(dedo >= 1 && dedo <= 5)) throw new ErroNotacao(`Dedo inválido em "${txt}"`)
  return { midi, dedo }
}

function tokens(texto: string): string[] {
  // junta acordes "[C3 E3 G3]:2" num token só
  const out: string[] = []
  const re = /\[[^\]]*\](?::[^\s|]+)?|[^\s|]+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(texto))) out.push(m[0])
  return out
}

/** Arredonda tempos para evitar erros de ponto flutuante (tercinas etc.). */
export function arred(x: number): number {
  return Math.round(x * 10000) / 10000
}

/**
 * Lê uma linha de notação e devolve as notas (com início em batidas a partir de `inicio`).
 * Retorna também o tempo final.
 */
export function lerNotacao(texto: string, mao: Mao, inicio = 0): { notas: NotaEv[]; fim: number } {
  const notas: NotaEv[] = []
  let t = inicio
  let dur = 1
  for (const tok of tokens(texto)) {
    let corpo = tok
    const idx = tok.lastIndexOf(':')
    if (idx > 0 && !tok.endsWith(']')) {
      corpo = tok.slice(0, idx)
      dur = lerDuracao(tok.slice(idx + 1))
    }
    if (/^(R|-|P)$/i.test(corpo)) {
      t += dur
      continue
    }
    const lista = corpo.startsWith('[') ? corpo.slice(1, -1).trim().split(/\s+/).filter(Boolean) : [corpo]
    if (!lista.length) throw new ErroNotacao(`Acorde vazio em "${tok}"`)
    for (const item of lista) {
      const { midi, dedo } = lerNotaComDedo(item)
      notas.push({ midi, inicio: arred(t), dur, mao, ...(dedo ? { dedo } : {}) })
    }
    t += dur
  }
  return { notas, fim: arred(t) }
}

// ---------- Cifras (harmonia) ----------

export interface AcordeCifra {
  /** classe de altura da fundamental 0..11 */
  raiz: number
  /** classe de altura do baixo (para "G7/B") */
  baixo: number
  /** intervalos em semitons a partir da raiz (tríade + 7ª se houver) */
  intervalos: number[]
}

/** "C", "Am", "G7", "F#m", "Bb", "D7", "C#m/B", "Cmaj7", "Bdim" */
export function lerCifra(txt: string): AcordeCifra {
  const m = /^([A-G])([#b]?)(maj7|m7|m|dim|aug|7|sus4)?(?:\/([A-G])([#b]?))?$/.exec(txt.trim())
  if (!m) throw new ErroNotacao(`Cifra inválida: "${txt}"`)
  const raiz = (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12
  const q = m[3] ?? ''
  const intervalos =
    q === 'm' ? [0, 3, 7] : q === 'm7' ? [0, 3, 7, 10] : q === '7' ? [0, 4, 7, 10] : q === 'maj7' ? [0, 4, 7, 11] : q === 'dim' ? [0, 3, 6] : q === 'aug' ? [0, 4, 8] : q === 'sus4' ? [0, 5, 7] : [0, 4, 7]
  const baixo = m[4] ? (PC[m[4]] + (m[5] === '#' ? 1 : m[5] === 'b' ? -1 : 0) + 12) % 12 : raiz
  return { raiz, baixo, intervalos }
}

export interface AcordeNoTempo {
  acorde: AcordeCifra
  inicio: number
  dur: number
}

/** "Am:3 E:3 R:1 C" — duração padrão = um compasso. R = sem acorde. */
export function lerHarmonia(texto: string, batidasPorCompasso: number, inicio = 0): AcordeNoTempo[] {
  const out: AcordeNoTempo[] = []
  let t = inicio
  let dur = batidasPorCompasso
  for (const tok of tokens(texto)) {
    let corpo = tok
    const idx = tok.lastIndexOf(':')
    if (idx > 0) {
      corpo = tok.slice(0, idx)
      dur = lerDuracao(tok.slice(idx + 1))
    } else {
      dur = batidasPorCompasso
    }
    if (!/^(R|-)$/i.test(corpo)) out.push({ acorde: lerCifra(corpo), inicio: arred(t), dur })
    t += dur
  }
  return out
}

/** Baixo na região grave confortável do CT-S300: Mi2 (40) até Ré#3 (51). */
export function midiBaixo(pc: number): number {
  const n = 36 + pc
  return n < 40 ? n + 12 : n
}

/** Notas do acorde (sem o baixo) em posição fechada logo acima do baixo, até Si3. */
export function notasAcordeFechado(a: AcordeCifra, baixo: number): number[] {
  const classes = a.intervalos.slice(0, 3).map((i) => (a.raiz + i) % 12).filter((pc) => pc !== a.baixo)
  const notas = classes.map((pc) => {
    let n = baixo + ((pc - baixo + 120) % 12)
    if (n <= baixo) n += 12
    return n
  })
  return notas.sort((x, y) => x - y).slice(0, 2)
}
