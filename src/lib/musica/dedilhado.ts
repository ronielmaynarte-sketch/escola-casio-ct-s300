// Dedilhado sugerido automaticamente (heurística simples de posição de mão).
// Não substitui um professor: só dá um ponto de partida coerente.

import { indiceBranco } from './notas'
import type { Mao, NotaEv } from './tipos'

/** Agrupa notas da mesma mão que começam juntas. */
function grupos(notas: NotaEv[]): NotaEv[][] {
  const ord = [...notas].sort((a, b) => a.inicio - b.inicio || a.midi - b.midi)
  const out: NotaEv[][] = []
  for (const n of ord) {
    const g = out[out.length - 1]
    if (g && Math.abs(g[0].inicio - n.inicio) < 1e-6) g.push(n)
    else out.push([n])
  }
  return out
}

function dedosAcorde(g: NotaEv[], mao: Mao): number[] {
  const asc = [...g].sort((a, b) => a.midi - b.midi)
  const span = indiceBranco(asc[asc.length - 1].midi) - indiceBranco(asc[0].midi)
  let d: number[]
  if (asc.length === 2) d = mao === 'direita' ? [1, Math.min(5, Math.max(2, Math.round(span) + 1))] : [Math.min(5, Math.max(2, Math.round(span) + 1)), 1]
  else if (asc.length === 3) d = mao === 'direita' ? [1, 3, 5] : [5, 3, 1]
  else d = mao === 'direita' ? [1, 2, 3, 4, 5].slice(0, asc.length) : [5, 4, 3, 2, 1].slice(5 - asc.length)
  return d
}

/**
 * Preenche `dedo` nas notas que não têm. Mão direita: polegar (1) na nota mais grave da posição.
 * Mão esquerda: mínimo (5) na mais grave. Troca de posição quando a próxima nota não cabe em 5 dedos,
 * escolhendo a posição que cobre o maior trecho seguinte.
 */
export function dedilhar(notas: NotaEv[], mao: Mao): NotaEv[] {
  const gs = grupos(notas.filter((n) => n.mao === mao))
  let base: number | null = null // índice branco da tecla do dedo mais grave (1 na direita, 5 na esquerda)
  const cabe = (b: number, midi: number) => {
    const d = indiceBranco(midi) - b
    return d >= -0.01 && d <= 4.01
  }
  const novaBase = (i: number): number => {
    // cobre o maior número de grupos seguintes possível
    let lo = Infinity
    let hi = -Infinity
    for (let j = i; j < gs.length; j++) {
      const ms = gs[j].map((n) => indiceBranco(n.midi))
      const nlo = Math.min(lo, ...ms)
      const nhi = Math.max(hi, ...ms)
      if (nhi - nlo > 4) break
      lo = nlo
      hi = nhi
    }
    return Math.floor(lo)
  }
  for (let i = 0; i < gs.length; i++) {
    const g = gs[i]
    if (g.length > 1) {
      const ds = dedosAcorde(g, mao)
      const asc = [...g].sort((a, b) => a.midi - b.midi)
      asc.forEach((n, k) => {
        if (n.dedo === undefined) n.dedo = ds[k]
      })
      base = null
      continue
    }
    const n = g[0]
    if (base === null || !cabe(base, n.midi)) base = novaBase(i)
    if (n.dedo === undefined) {
      const rel = Math.round(indiceBranco(n.midi) - base)
      n.dedo = mao === 'direita' ? Math.min(5, Math.max(1, rel + 1)) : Math.min(5, Math.max(1, 5 - rel))
    }
  }
  return notas
}
