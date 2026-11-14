// Converte um arquivo MIDI (ou texto em notação simples) do próprio aluno numa MusicaDef com os três níveis.

import { dedilhar } from './dedilhado'
import type { ArquivoMidi } from './midiArquivo'
import { construirMusica } from './construir'
import type { MusicaJson, SecaoJson } from './construir'
import { arred } from './notacao'
import { MIDI_MAX, MIDI_MIN } from './notas'
import type { Categoria, Mao, MusicaDef, Nivel, NotaEv, SecaoDef } from './tipos'

export interface OpcoesImportacao {
  titulo: string
  categoria: Categoria
  /** 'faixas': escolher a faixa de cada mão; 'altura': dividir as notas pela altura (ponto de divisão) */
  separacao: 'faixas' | 'altura'
  faixaDireita?: number | null
  faixaEsquerda?: number | null
  /** faixas usadas na separação por altura (padrão: todas com notas) */
  faixasAltura?: number[]
  divisao?: number
  /** grade de quantização em batidas (0.25 = semicolcheia em 4/4) */
  quantizacao?: number
  /** 'auto' (encaixa nas 61 teclas) ou semitons */
  transpor?: 'auto' | number
  compassosPorSecao?: number
}

export interface Aviso {
  texto: string
}

export const LIMITE_NOTAS = 4000

/** Escolhe o deslocamento em oitavas que deixa mais notas dentro de 36–96; o resto é dobrado para dentro. */
export function encaixarNoTeclado(midis: number[], transpor: 'auto' | number = 'auto'): { desloc: number; mapa: (m: number) => number } {
  let desloc = 0
  if (transpor === 'auto') {
    let melhor = Infinity
    for (let k = -4; k <= 4; k++) {
      const fora = midis.filter((m) => m + 12 * k < MIDI_MIN || m + 12 * k > MIDI_MAX).length
      const custo = fora * 100 + Math.abs(k)
      if (custo < melhor) {
        melhor = custo
        desloc = 12 * k
      }
    }
  } else desloc = transpor
  const mapa = (m: number) => {
    let n = m + desloc
    while (n < MIDI_MIN) n += 12
    while (n > MIDI_MAX) n -= 12
    return n
  }
  return { desloc, mapa }
}

function melodiaDoTopo(notas: NotaEv[]): NotaEv[] {
  const porT = new Map<number, NotaEv>()
  for (const n of notas) {
    const a = porT.get(n.inicio)
    if (!a || n.midi > a.midi) porT.set(n.inicio, n)
  }
  return [...porT.values()].sort((a, b) => a.inicio - b.inicio)
}

function baixoNoTempo1(esq: NotaEv[], bpc: number): NotaEv[] {
  const porCompasso = new Map<number, NotaEv[]>()
  for (const n of esq) {
    const c = Math.floor(n.inicio / bpc + 1e-6)
    if (!porCompasso.has(c)) porCompasso.set(c, [])
    porCompasso.get(c)!.push(n)
  }
  const out: NotaEv[] = []
  for (const [c, ns] of porCompasso) {
    const primeiro = Math.min(...ns.map((n) => n.inicio))
    const grave = ns.filter((n) => n.inicio === primeiro).reduce((a, b) => (b.midi < a.midi ? b : a))
    out.push({ ...grave, dur: Math.max(grave.dur, (c + 1) * bpc - primeiro) })
  }
  return out.sort((a, b) => a.inicio - b.inicio)
}

export function niveisDasNotas(todas: NotaEv[], bpc: number): Record<Nivel, NotaEv[]> {
  const dir = todas.filter((n) => n.mao === 'direita')
  const esq = todas.filter((n) => n.mao === 'esquerda')
  const mel = melodiaDoTopo(dir)
  const c = (ns: NotaEv[]) => ns.map((n) => ({ ...n, dedo: undefined }))
  const niveis: Record<Nivel, NotaEv[]> = {
    facil: c(mel),
    intermediario: [...c(mel), ...c(baixoNoTempo1(esq, bpc))],
    avancado: c(todas),
  }
  for (const k of Object.keys(niveis) as Nivel[]) {
    niveis[k].sort((a, b) => a.inicio - b.inicio || a.midi - b.midi)
    dedilhar(niveis[k], 'direita')
    dedilhar(niveis[k], 'esquerda')
  }
  return niveis
}

export function secoesPorCompassos(fim: number, bpc: number, porSecao: number): SecaoDef[] {
  const tam = bpc * porSecao
  const out: SecaoDef[] = []
  for (let t = 0, i = 1; t < fim - 1e-6; t += tam, i++) {
    const c1 = Math.round(t / bpc) + 1
    const c2 = Math.min(Math.ceil(fim / bpc), Math.round((t + tam) / bpc))
    out.push({ nome: `Parte ${i} (compassos ${c1}–${c2})`, inicio: arred(t), fim: arred(Math.min(fim, t + tam)) })
  }
  if (out.length) out[out.length - 1].fim = arred(fim)
  return out
}

export function idImportada(titulo: string): string {
  const base = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `imp-${base || 'musica'}-${Date.now().toString(36)}`
}

export function importarMidi(arq: ArquivoMidi, op: OpcoesImportacao): { musica: MusicaDef; avisos: Aviso[] } {
  const avisos: Aviso[] = []
  const compasso: [number, number] = arq.compasso && arq.compasso[0] > 0 ? arq.compasso : [4, 4]
  const bpc = compasso[0]
  const ticksPorBatida = (arq.divisao * 4) / compasso[1]
  const us = arq.tempos[0]?.usPorSeminima ?? 500000
  if (arq.tempos.length > 1) avisos.push({ texto: `O arquivo muda de andamento ${arq.tempos.length - 1} vez(es); usamos o primeiro andamento.` })
  const bpm = Math.round((60000000 / us) * (compasso[1] / 4))
  const divisao = op.divisao ?? 60
  const q = op.quantizacao ?? 0.25

  let brutas: { midi: number; inicio: number; dur: number; mao: Mao }[] = []
  const pegar = (iFaixa: number, mao: Mao | null) => {
    const f = arq.faixas[iFaixa]
    if (!f) return
    for (const n of f.notas) {
      brutas.push({ midi: n.midi, inicio: n.inicioTick / ticksPorBatida, dur: n.durTick / ticksPorBatida, mao: mao ?? (n.midi >= divisao ? 'direita' : 'esquerda') })
    }
  }
  if (op.separacao === 'faixas') {
    if (op.faixaDireita != null) pegar(op.faixaDireita, 'direita')
    if (op.faixaEsquerda != null && op.faixaEsquerda !== op.faixaDireita) pegar(op.faixaEsquerda, 'esquerda')
  } else {
    const lista = op.faixasAltura ?? arq.faixas.filter((f) => f.notas.length).map((f) => f.indice)
    for (const i of lista) pegar(i, null)
  }
  if (!brutas.length) throw new Error('Nenhuma nota encontrada nas faixas escolhidas.')

  // transposição para caber nas 61 teclas
  const { desloc, mapa } = encaixarNoTeclado(
    brutas.map((n) => n.midi),
    op.transpor ?? 'auto',
  )
  const foraAntes = brutas.filter((n) => n.midi + desloc < MIDI_MIN || n.midi + desloc > MIDI_MAX).length
  if (desloc) avisos.push({ texto: `Transpusemos ${Math.abs(desloc / 12)} oitava(s) para ${desloc > 0 ? 'cima' : 'baixo'} para caber no CT-S300.` })
  if (foraAntes) avisos.push({ texto: `${foraAntes} nota(s) ficavam fora das 61 teclas e foram trazidas uma oitava para dentro.` })

  // quantização
  brutas = brutas.map((n) => {
    const ini = Math.round(n.inicio / q) * q
    const dur = Math.max(q, Math.round(n.dur / q) * q)
    return { ...n, midi: mapa(n.midi), inicio: ini, dur }
  })
  // começa no primeiro compasso com nota
  const primeiro = Math.min(...brutas.map((n) => n.inicio))
  const off = Math.floor(primeiro / bpc) * bpc
  const vistos = new Set<string>()
  let notas: NotaEv[] = []
  for (const n of brutas.sort((a, b) => a.inicio - b.inicio || a.midi - b.midi)) {
    const ini = arred(n.inicio - off)
    const k = `${n.mao}:${n.midi}:${ini}`
    if (vistos.has(k)) continue
    vistos.add(k)
    notas.push({ midi: n.midi, inicio: ini, dur: arred(n.dur), mao: n.mao })
  }
  if (notas.length > LIMITE_NOTAS) {
    avisos.push({ texto: `A música tem ${notas.length} notas; guardamos só as primeiras ${LIMITE_NOTAS}.` })
    notas = notas.slice(0, LIMITE_NOTAS)
  }
  const fim = Math.max(...notas.map((n) => n.inicio + n.dur))
  const fimCompasso = Math.ceil(fim / bpc - 1e-6) * bpc
  const secoes = secoesPorCompassos(fimCompasso, bpc, op.compassosPorSecao ?? 4)
  if (!notas.some((n) => n.mao === 'esquerda')) avisos.push({ texto: 'Não há notas para a mão esquerda: os modos de mão esquerda ficarão vazios.' })

  const musica: MusicaDef = {
    id: idImportada(op.titulo),
    titulo: op.titulo.trim() || 'Música importada',
    compositor: 'Arquivo do aluno',
    categoria: op.categoria,
    origem: 'importada',
    compasso,
    bpm: Math.min(240, Math.max(30, bpm)),
    licenca: 'Arquivo enviado pelo próprio aluno, guardado só neste aparelho.',
    divisao,
    niveis: niveisDasNotas(notas, bpc),
    secoes,
  }
  return { musica, avisos }
}

// ---------- texto ----------

/**
 * Formato de texto para importar:
 *   titulo: Minha música
 *   bpm: 90
 *   compasso: 2/4
 *   secao: Parte 1
 *   md: C4:1 D4 E4 | F4:2
 *   me: C3:2 | F3:2
 *   harmonia: C:2 F:2     (opcional, gera a mão esquerda se "me" não vier)
 */
export function importarTexto(texto: string, categoria: Categoria): MusicaDef {
  let titulo = 'Música em texto'
  let bpm = 90
  let compasso: [number, number] = [4, 4]
  const secoes: SecaoJson[] = []
  let atual: SecaoJson | null = null
  const nova = (nome: string) => {
    atual = { nome, md: '' }
    secoes.push(atual)
    return atual
  }
  for (const linhaBruta of texto.split(/\r?\n/)) {
    const linha = linhaBruta.trim()
    if (!linha || linha.startsWith('#')) continue
    const m = /^([a-zA-Zçã]+)\s*:\s*(.*)$/.exec(linha)
    if (!m) throw new Error(`Linha não entendida: "${linha}"`)
    const chave = m[1].toLowerCase()
    const v = m[2].trim()
    if (chave === 'titulo' || chave === 'título') titulo = v
    else if (chave === 'bpm') bpm = Number(v) || 90
    else if (chave === 'compasso') {
      const c = /^(\d+)\s*\/\s*(\d+)$/.exec(v)
      if (!c) throw new Error('Compasso deve ser como 4/4 ou 3/4.')
      compasso = [Number(c[1]), Number(c[2])]
    } else if (chave === 'secao' || chave === 'seção') nova(v || `Parte ${secoes.length + 1}`)
    else if (chave === 'md') {
      const s: SecaoJson = atual ?? nova(`Parte ${secoes.length + 1}`)
      s.md = (s.md ? s.md + ' ' : '') + v
    } else if (chave === 'me') {
      const s: SecaoJson = atual ?? nova(`Parte ${secoes.length + 1}`)
      s.meAvancado = (s.meAvancado ? s.meAvancado + ' ' : '') + v
      s.meIntermediario = s.meAvancado
    } else if (chave === 'harmonia') {
      const s: SecaoJson = atual ?? nova(`Parte ${secoes.length + 1}`)
      s.harmonia = (s.harmonia ? s.harmonia + ' ' : '') + v
    } else throw new Error(`Campo desconhecido: "${m[1]}"`)
  }
  if (!secoes.some((s) => s.md.trim())) throw new Error('Escreva pelo menos uma linha "md:" com as notas da mão direita.')
  const j: MusicaJson = {
    id: idImportada(titulo),
    titulo,
    compositor: 'Texto do aluno',
    categoria,
    compasso,
    bpm,
    licenca: 'Texto escrito pelo próprio aluno, guardado só neste aparelho.',
    secoes: secoes.filter((s) => s.md.trim()),
  }
  const m = construirMusica(j)
  const fora = Object.values(m.niveis).flat().filter((n) => n.midi < MIDI_MIN || n.midi > MIDI_MAX)
  if (fora.length) throw new Error(`Há ${fora.length} nota(s) fora das 61 teclas do CT-S300 (Dó2 a Dó7).`)
  return { ...m, origem: 'importada' }
}
