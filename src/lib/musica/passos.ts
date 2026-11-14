// Transforma as notas de uma música em "passos" do modo espera e monta os planos de prática.

import { arred } from './notacao'
import type { Mao, Modo, MusicaDef, Nivel, NotaEv, Passo } from './tipos'

export type Maos = Mao | 'juntas'

export interface OpcoesPassos {
  maos: Maos
  /** batida inicial (inclusiva) e final (exclusiva) */
  inicio?: number
  fim?: number
  /** só a nota mais aguda da mão direita (melodia) */
  soMelodia?: boolean
}

export function secaoDoTempo(m: MusicaDef, t: number): number {
  for (let i = m.secoes.length - 1; i >= 0; i--) if (t >= m.secoes[i].inicio - 1e-6) return i
  return 0
}

export function temMaoEsquerda(m: MusicaDef, nivel: Nivel): boolean {
  return m.niveis[nivel].some((n) => n.mao === 'esquerda')
}

/** Nível efetivo quando o trecho precisa da mão esquerda e o nível escolhido não tem. */
export function nivelComEsquerda(m: MusicaDef, nivel: Nivel): Nivel {
  if (temMaoEsquerda(m, nivel)) return nivel
  if (temMaoEsquerda(m, 'intermediario')) return 'intermediario'
  return 'avancado'
}

export function gerarPassos(m: MusicaDef, nivel: Nivel, op: OpcoesPassos): Passo[] {
  const inicio = op.inicio ?? 0
  const fim = op.fim ?? Infinity
  let notas: NotaEv[] = m.niveis[nivel].filter(
    (n) => n.inicio >= inicio - 1e-6 && n.inicio < fim - 1e-6 && (op.maos === 'juntas' || n.mao === op.maos),
  )
  if (op.soMelodia) {
    const porT = new Map<number, NotaEv>()
    for (const n of notas) {
      if (n.mao !== 'direita') continue
      const k = arred(n.inicio)
      const a = porT.get(k)
      if (!a || n.midi > a.midi) porT.set(k, n)
    }
    notas = [...porT.values()]
  }
  notas = [...notas].sort((a, b) => a.inicio - b.inicio || a.midi - b.midi)
  const bpc = m.compasso[0]
  const passos: Passo[] = []
  for (const n of notas) {
    const t = arred(n.inicio)
    let p = passos[passos.length - 1]
    if (!p || Math.abs(p.t - t) > 1e-6) {
      p = { t, dur: n.dur, notas: [], secao: secaoDoTempo(m, t), compasso: Math.floor(t / bpc + 1e-6) + 1 }
      passos.push(p)
    }
    if (!p.notas.some((x) => x.midi === n.midi)) p.notas.push({ midi: n.midi, mao: n.mao, dedo: n.dedo })
    p.dur = Math.max(p.dur, n.dur)
  }
  for (let i = 0; i < passos.length - 1; i++) passos[i].dur = arred(passos[i + 1].t - passos[i].t)
  return passos
}

// ---------- Planos ----------

export interface Trecho {
  rotulo: string
  maos: Maos
  nivel: Nivel
  inicio: number
  fim: number
  soMelodia?: boolean
  /** repete o trecho até uma passada sem erros (máx. 5 tentativas) */
  repetirAteAcertar?: boolean
}

export interface Plano {
  titulo: string
  trechos: Trecho[]
  /** Desafio: esconde nomes, dedos e luz das próximas teclas */
  ocultarDicas: boolean
  /** velocidade sugerida (1 = 100%) */
  velocidadeSugerida?: number
}

function faixa(m: MusicaDef, secoes?: [number, number]): { inicio: number; fim: number; a: number; b: number } {
  const a = Math.max(0, secoes?.[0] ?? 0)
  const b = Math.min(m.secoes.length - 1, secoes?.[1] ?? m.secoes.length - 1)
  return { inicio: m.secoes[a].inicio, fim: m.secoes[b].fim, a, b }
}

export function planoDoModo(m: MusicaDef, nivel: Nivel, modo: Modo, secoes?: [number, number]): Plano {
  const f = faixa(m, secoes)
  const nivelE = nivelComEsquerda(m, nivel)
  const t = (rotulo: string, maos: Maos, extra: Partial<Trecho> = {}): Trecho => ({
    rotulo,
    maos,
    nivel: maos === 'direita' ? nivel : nivelE,
    inicio: f.inicio,
    fim: f.fim,
    ...extra,
  })
  switch (modo) {
    case 'direita':
      return { titulo: 'Só mão direita', trechos: [t('Mão direita', 'direita')], ocultarDicas: false }
    case 'esquerda':
      return { titulo: 'Só mão esquerda', trechos: [t('Mão esquerda', 'esquerda')], ocultarDicas: false }
    case 'juntas':
      return { titulo: 'Mãos juntas', trechos: [t('Mãos juntas', 'juntas')], ocultarDicas: false }
    case 'desafio':
      return { titulo: 'Desafio', trechos: [t('Desafio — mãos juntas', 'juntas')], ocultarDicas: true }
    case 'facil':
      return {
        titulo: 'Fácil',
        trechos: [{ rotulo: 'Melodia', maos: 'direita', nivel: 'facil', inicio: f.inicio, fim: f.fim, soMelodia: true }],
        ocultarDicas: false,
        velocidadeSugerida: 0.7,
      }
    case 'separadas': {
      const trechos: Trecho[] = []
      for (let i = f.a; i <= f.b; i++) {
        const s = m.secoes[i]
        trechos.push({ rotulo: `${s.nome} — mão direita`, maos: 'direita', nivel, inicio: s.inicio, fim: s.fim })
        trechos.push({ rotulo: `${s.nome} — mão esquerda`, maos: 'esquerda', nivel: nivelE, inicio: s.inicio, fim: s.fim })
        trechos.push({ rotulo: `${s.nome} — mãos juntas`, maos: 'juntas', nivel: nivelE, inicio: s.inicio, fim: s.fim })
      }
      return { titulo: 'Mãos separadas', trechos, ocultarDicas: false }
    }
  }
}

export interface LicaoDef {
  id: string
  numero: number
  titulo: string
  descricao: string
  plano: Plano
}

/** Lições passo a passo L1–L6 geradas das seções da música. */
export function licoesDaMusica(m: MusicaDef, nivel: Nivel): LicaoDef[] {
  const s0 = m.secoes[0]
  const s1 = m.secoes[Math.min(1, m.secoes.length - 1)]
  const ate2 = m.secoes[Math.min(1, m.secoes.length - 1)].fim
  const nivelE = nivelComEsquerda(m, nivel)
  const fimMusica = m.secoes[m.secoes.length - 1].fim
  const L = (numero: number, titulo: string, descricao: string, trechos: Trecho[]): LicaoDef => ({
    id: `L${numero}`,
    numero,
    titulo,
    descricao,
    plano: { titulo: `L${numero} · ${titulo}`, trechos, ocultarDicas: false },
  })
  return [
    L(1, 'Primeira frase — mão direita', `Aprenda "${s0.nome}" só com a mão direita.`, [
      { rotulo: `${s0.nome} — mão direita`, maos: 'direita', nivel, inicio: s0.inicio, fim: s0.fim },
    ]),
    L(2, 'Repetir até acertar', `Toque "${s0.nome}" de novo até sair sem nenhum erro.`, [
      { rotulo: `${s0.nome} — sem erros`, maos: 'direita', nivel, inicio: s0.inicio, fim: s0.fim, repetirAteAcertar: true },
    ]),
    L(3, 'Próxima frase', `Agora "${s1.nome}" com a mão direita.`, [
      { rotulo: `${s1.nome} — mão direita`, maos: 'direita', nivel, inicio: s1.inicio, fim: s1.fim },
    ]),
    L(4, 'Mão esquerda — baixo e acordes', 'O acompanhamento das primeiras frases, só com a mão esquerda.', [
      { rotulo: 'Mão esquerda', maos: 'esquerda', nivel: nivelE, inicio: s0.inicio, fim: ate2 },
    ]),
    L(5, 'Mãos juntas', 'As primeiras frases com as duas mãos.', [
      { rotulo: 'Mãos juntas', maos: 'juntas', nivel: nivelE, inicio: s0.inicio, fim: ate2 },
    ]),
    L(6, 'Música completa', 'A música inteira, do começo ao fim.', [
      { rotulo: 'Música completa', maos: 'juntas', nivel, inicio: 0, fim: fimMusica },
    ]),
  ]
}
