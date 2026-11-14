// Constrói uma MusicaDef (três níveis) a partir do JSON em notação de texto.

import { dedilhar } from './dedilhado'
import { arred, lerHarmonia, lerNotacao, midiBaixo, notasAcordeFechado } from './notacao'
import type { AcordeNoTempo } from './notacao'
import type { Categoria, MusicaDef, Nivel, NotaEv, SecaoDef } from './tipos'

export interface SecaoJson {
  nome: string
  /** melodia da mão direita */
  md: string
  /** cifras: "C:4 G:2 C:2" (duração padrão = 1 compasso) */
  harmonia?: string
  /** mão esquerda explícita para o nível intermediário (senão: baixo da cifra no tempo 1) */
  meIntermediario?: string
  /** mão esquerda explícita para o nível avançado (senão: baixo + acorde gerados da cifra) */
  meAvancado?: string
  /** mão direita diferente para o avançado (ex.: com notas internas) */
  mdAvancado?: string
}

export interface MusicaJson {
  id: string
  titulo: string
  compositor: string
  categoria: Categoria
  compasso: [number, number]
  bpm: number
  tonalidade?: string
  descricao?: string
  licenca: string
  fontes?: string[]
  ritmoAproximado?: boolean
  divisao?: number
  observacoes?: Partial<Record<Nivel, string>>
  secoes: SecaoJson[]
}

function baixosIntermediario(h: AcordeNoTempo[]): NotaEv[] {
  return h.map((a) => ({ midi: midiBaixo(a.acorde.baixo), inicio: a.inicio, dur: a.dur, mao: 'esquerda' as const }))
}

function acompanhamentoAvancado(h: AcordeNoTempo[]): NotaEv[] {
  const out: NotaEv[] = []
  for (const a of h) {
    const b = midiBaixo(a.acorde.baixo)
    const dyad = notasAcordeFechado(a.acorde, b)
    const add = (midis: number[], t: number, d: number) => midis.forEach((m) => out.push({ midi: m, inicio: arred(t), dur: d, mao: 'esquerda' }))
    if (a.dur >= 4 - 1e-6) {
      add([b], a.inicio, 2)
      add(dyad, a.inicio + 2, a.dur - 2)
    } else if (Math.abs(a.dur - 3) < 1e-6) {
      add([b], a.inicio, 1)
      add(dyad, a.inicio + 1, 1)
      add(dyad, a.inicio + 2, 1)
    } else if (Math.abs(a.dur - 2) < 1e-6) {
      add([b], a.inicio, 1)
      add(dyad, a.inicio + 1, 1)
    } else {
      add([b], a.inicio, a.dur)
    }
  }
  return out
}

export function construirMusica(j: MusicaJson): MusicaDef {
  const bpc = j.compasso[0]
  const niveis: Record<Nivel, NotaEv[]> = { facil: [], intermediario: [], avancado: [] }
  const secoes: SecaoDef[] = []
  let t = 0
  for (const s of j.secoes) {
    const md = lerNotacao(s.md, 'direita', t)
    const mdAv = s.mdAvancado ? lerNotacao(s.mdAvancado, 'direita', t) : md
    const harm = s.harmonia ? lerHarmonia(s.harmonia, bpc, t) : []
    const meInt = s.meIntermediario ? lerNotacao(s.meIntermediario, 'esquerda', t).notas : baixosIntermediario(harm)
    const meAv = s.meAvancado ? lerNotacao(s.meAvancado, 'esquerda', t).notas : acompanhamentoAvancado(harm)
    const clone = (ns: NotaEv[]) => ns.map((n) => ({ ...n }))
    niveis.facil.push(...clone(md.notas))
    niveis.intermediario.push(...clone(md.notas), ...clone(meInt))
    niveis.avancado.push(...clone(mdAv.notas), ...clone(meAv))
    const fim = Math.max(md.fim, mdAv.fim)
    secoes.push({ nome: s.nome, inicio: t, fim })
    t = fim
  }
  for (const nv of Object.keys(niveis) as Nivel[]) {
    niveis[nv].sort((a, b) => a.inicio - b.inicio || a.midi - b.midi)
    dedilhar(niveis[nv], 'direita')
    dedilhar(niveis[nv], 'esquerda')
  }
  return {
    id: j.id,
    titulo: j.titulo,
    compositor: j.compositor,
    categoria: j.categoria,
    origem: 'embutida',
    compasso: j.compasso,
    bpm: j.bpm,
    tonalidade: j.tonalidade,
    descricao: j.descricao,
    licenca: j.licenca,
    fontes: j.fontes,
    ritmoAproximado: j.ritmoAproximado,
    divisao: j.divisao,
    observacoes: j.observacoes,
    niveis,
    secoes,
  }
}
