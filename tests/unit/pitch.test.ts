// Testes offline do detector do microfone com sinais sintetizados.
import { describe, expect, it } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { detectarPitch } from '../../src/lib/input/pitch'
import { ProcessadorMic } from '../../src/lib/input/processadorMic'
import type { EventoMic } from '../../src/lib/input/processadorMic'
import { analisarAcorde } from '../../src/lib/input/acordes'
import { espectroMagnitude } from '../../src/lib/input/fft'
import { SR, concatenar, rng, ruido, silencio, somar, tom } from './sinais'

const RESULTADOS: Record<string, unknown> = {}
const faixas = [
  ['Dó2–Si2 (36–47)', 36, 47],
  ['Dó3–Si3 (48–59)', 48, 59],
  ['Dó4–Si4 (60–71)', 60, 71],
  ['Dó5–Si5 (72–83)', 72, 83],
  ['Dó6–Dó7 (84–96)', 84, 96],
] as const

function simular(sinal: Float32Array, proc: ProcessadorMic, hop = 512, W = 4096): { t: number; e: EventoMic }[] {
  const out: { t: number; e: EventoMic }[] = []
  const buf = new Float32Array(W)
  for (let fim = hop; fim <= sinal.length; fim += hop) {
    const ini = fim - W
    if (ini >= 0) buf.set(sinal.subarray(ini, fim))
    else {
      buf.fill(0)
      buf.set(sinal.subarray(0, fim), -ini)
    }
    const t = (fim / SR) * 1000
    for (const e of proc.processar(buf, t)) out.push({ t, e })
  }
  return out
}

describe('detector de altura (quadro único, 4096 amostras)', () => {
  for (const timbre of ['seno', 'harmonicos', 'piano', 'alto-falante'] as const) {
    it(`acerta as 61 notas — timbre ${timbre}`, () => {
      let ok = 0
      const erros: string[] = []
      for (let m = 36; m <= 96; m++) {
        const s = somar(tom(m, { timbre, dur: 0.3 }), ruido(Math.floor(0.3 * SR), 0.005, rng(m)))
        const r = detectarPitch(s.subarray(1500, 1500 + 4096), SR)
        const d = Math.round(69 + 12 * Math.log2(r.freq / 440))
        if (d === m) ok++
        else erros.push(`${m}->${d}`)
      }
      RESULTADOS[`quadro_${timbre}`] = { acertos: ok, total: 61, erros }
      expect(ok).toBeGreaterThanOrEqual(60)
    })
  }
})

describe('microfone: fluxo contínuo com ataque, portão de ruído e estabilização', () => {
  const casos = [
    { nome: 'piano, ruído baixo', timbre: 'piano' as const, ruido: 0.003 },
    { nome: 'piano, ruído médio (-30 dB)', timbre: 'piano' as const, ruido: 0.01 },
    { nome: 'alto-falante pequeno (graves cortados), ruído médio', timbre: 'alto-falante' as const, ruido: 0.01 },
    { nome: 'piano desafinado +25 cents', timbre: 'piano' as const, ruido: 0.005, cents: 25 },
  ]
  for (const c of casos) {
    it(`cada nota 36–96 gera exatamente um "on" correto — ${c.nome}`, () => {
      const porFaixa: Record<string, { ok: number; total: number; erros: string[] }> = {}
      let ok = 0
      for (let m = 36; m <= 96; m++) {
        const proc = new ProcessadorMic(SR, { ruido: c.ruido / 1.7 })
        const nota = tom(m, { timbre: c.timbre, dur: 0.7, amp: 0.3, cents: c.cents ?? 0 })
        const s = somar(concatenar(silencio(0.25), nota, silencio(0.2)), ruido(Math.floor(1.15 * SR) + 10, c.ruido, rng(m + 7)))
        const ons = simular(s, proc).filter((x) => x.e.tipo === 'on')
        const certo = ons.length === 1 && ons[0].e.midi === m
        if (certo) ok++
        const f = faixas.find(([, a, b]) => m >= a && m <= b)![0]
        porFaixa[f] ??= { ok: 0, total: 0, erros: [] }
        porFaixa[f].total++
        if (certo) porFaixa[f].ok++
        else porFaixa[f].erros.push(`${m}->[${ons.map((o) => o.e.midi).join(',')}]`)
      }
      RESULTADOS[`fluxo_${c.nome}`] = { acertos: ok, total: 61, porFaixa }
      expect(ok).toBeGreaterThanOrEqual(58)
    })
  }

  it('notas repetidas (mesma tecla 4×) geram 4 ataques', () => {
    const r = rng(3)
    let total = 0
    let ok = 0
    for (const m of [40, 48, 55, 60, 64, 67, 72, 79, 84, 91]) {
      const proc = new ProcessadorMic(SR, { ruido: 0.002 })
      const partes = [silencio(0.2)]
      for (let i = 0; i < 4; i++) partes.push(tom(m, { dur: 0.32, amp: 0.25 + 0.05 * r() }))
      partes.push(silencio(0.2))
      const s = somar(concatenar(...partes), ruido(Math.floor(2 * SR), 0.003))
      const ons = simular(s, proc).filter((x) => x.e.tipo === 'on')
      total++
      if (ons.length === 4 && ons.every((o) => o.e.midi === m)) ok++
    }
    RESULTADOS.repetidas = { acertos: ok, total }
    expect(ok).toBeGreaterThanOrEqual(9)
  })

  it('melodia ligada (Ode à Alegria, 15 notas) sai na ordem certa', () => {
    const mel = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62]
    const proc = new ProcessadorMic(SR, { ruido: 0.002 })
    // cada nota começa enquanto a anterior ainda soa (sobreposição de 60 ms)
    const dur = 0.4
    const n = Math.floor((mel.length * dur + 0.6) * SR)
    const s = new Float32Array(n)
    mel.forEach((m, i) => {
      const t = tom(m, { dur: dur + 0.06, amp: 0.3 })
      const o = Math.floor((0.2 + i * dur) * SR)
      for (let k = 0; k < t.length && o + k < n; k++) s[o + k] += t[k]
    })
    const ons = simular(somar(s, ruido(n, 0.003)), proc).filter((x) => x.e.tipo === 'on').map((x) => x.e.midi)
    RESULTADOS.melodia = { esperado: mel, detectado: ons }
    expect(ons).toEqual(mel)
  })

  it('só ruído (ambiente) não gera nenhuma nota depois da calibração', () => {
    const amb = ruido(Math.floor(3 * SR), 0.01, rng(5))
    const proc = new ProcessadorMic(SR, { ruido: 0.01 / Math.sqrt(3) })
    const ev = simular(amb, proc)
    RESULTADOS.ruido = { eventos: ev.length }
    expect(ev.length).toBe(0)
  })

  it('não ouve enquanto o app toca (mudo)', () => {
    const proc = new ProcessadorMic(SR, { ruido: 0.002 })
    proc.setMudo(true)
    const ev = simular(concatenar(silencio(0.2), tom(60), silencio(0.2)), proc)
    expect(ev.length).toBe(0)
  })

  it('proteção de oitava: com a nota esperada, graves com fundamental fraca não sobem uma oitava', () => {
    let ok = 0
    let total = 0
    for (let m = 36; m <= 59; m++) {
      const proc = new ProcessadorMic(SR, { ruido: 0.002 })
      proc.setEsperadas([m])
      const s = somar(concatenar(silencio(0.2), tom(m, { timbre: 'alto-falante', dur: 0.7 }), silencio(0.1)), ruido(Math.floor(1.0 * SR) + 10, 0.004))
      const ons = simular(s, proc).filter((x) => x.e.tipo === 'on')
      total++
      if (ons.length === 1 && ons[0].e.midi === m) ok++
    }
    RESULTADOS.oitava_com_esperada = { acertos: ok, total }
    expect(ok).toBe(total)
  })
})

describe('acordes pelo microfone (experimental)', () => {
  const formas: { nome: string; notas: (r: number) => number[] }[] = [
    { nome: 'tríade maior', notas: (r) => [r, r + 4, r + 7] },
    { nome: 'tríade menor', notas: (r) => [r, r + 3, r + 7] },
    { nome: 'quinta (2 notas)', notas: (r) => [r, r + 7] },
    { nome: 'terça (2 notas)', notas: (r) => [r, r + 4] },
    { nome: 'baixo + terça e quinta (mão esquerda)', notas: (r) => [r, r + 16, r + 19] },
  ]
  const raizes = [38, 41, 43, 45, 48, 50, 53, 55, 57, 60, 62, 64, 65, 67, 69, 72, 74, 76, 79]

  function espectroDe(notas: number[], seed: number, timbre: 'piano' | 'alto-falante' = 'piano'): Float64Array {
    const r = rng(seed)
    const s = somar(...notas.map((m) => tom(m, { dur: 0.35, amp: 0.2 + 0.1 * r(), timbre }, rng(seed + m))), ruido(Math.floor(0.35 * SR), 0.004, rng(seed)))
    const ini = Math.floor(0.06 * SR)
    return espectroMagnitude(s.subarray(ini, ini + 4096), 8192)
  }

  it('reconhece acordes completos, percebe nota faltando e nota errada', () => {
    const tab: Record<string, { completo: [number, number]; faltando: [number, number]; errada: [number, number] }> = {}
    let tc = 0, nc = 0, tf = 0, nf = 0, te = 0, ne = 0, tx = 0
    for (const f of formas) {
      const linha = { completo: [0, 0] as [number, number], faltando: [0, 0] as [number, number], errada: [0, 0] as [number, number] }
      for (const r0 of raizes) {
        const notas = f.notas(r0).filter((m) => m >= 36 && m <= 96)
        if (notas.length < 2 || notas.some((m) => m > 96)) continue
        // 1) completo: todas presentes e nenhuma errada
        const a = analisarAcorde(espectroDe(notas, r0), SR, 8192, notas)
        linha.completo[1]++
        if (a.presentes.length === notas.length && a.errada === null) linha.completo[0]++
        // 2) faltando uma nota (a do meio ou a de cima): o acorde NÃO pode ser dado como completo
        const falta = notas[notas.length - 1]
        const b = analisarAcorde(espectroDe(notas.filter((m) => m !== falta), r0 + 100), SR, 8192, notas)
        linha.faltando[1]++
        if (!b.presentes.includes(falta)) linha.faltando[0]++
        // 3) uma nota trocada por outra a 1–2 semitons: deve faltar a certa ou acusar a errada
        const troca = notas[notas.length - 1]
        const errada = troca + (r0 % 2 ? 2 : -1)
        const c = analisarAcorde(espectroDe([...notas.filter((m) => m !== troca), errada], r0 + 200), SR, 8192, notas)
        linha.errada[1]++
        if (!c.presentes.includes(troca) || c.errada !== null) linha.errada[0]++
        if (c.errada === errada) tx++
      }
      tab[f.nome] = linha
      tc += linha.completo[0]; nc += linha.completo[1]
      tf += linha.faltando[0]; nf += linha.faltando[1]
      te += linha.errada[0]; ne += linha.errada[1]
    }
    RESULTADOS.acordes = {
      porForma: tab,
      completoDetectado: `${tc}/${nc} (${Math.round((100 * tc) / nc)}%)`,
      faltandoPercebido: `${tf}/${nf} (${Math.round((100 * tf) / nf)}%)`,
      erradaPercebida: `${te}/${ne} (${Math.round((100 * te) / ne)}%)`,
      erradaIdentificadaExata: `${tx}/${ne} (${Math.round((100 * tx) / ne)}%)`,
    }
    expect(tc / nc).toBeGreaterThan(0.85)
    expect(tf / nf).toBeGreaterThan(0.85)
    expect(te / ne).toBeGreaterThan(0.85)
  })

  it('processador no modo acorde emite as notas esperadas', () => {
    let ok = 0
    let total = 0
    for (const r0 of [48, 53, 55, 60, 62, 65, 67]) {
      const notas = [r0, r0 + 4, r0 + 7]
      const proc = new ProcessadorMic(SR, { ruido: 0.002 })
      proc.setEsperadas(notas)
      const s = somar(concatenar(silencio(0.2), somar(...notas.map((m) => tom(m, { dur: 0.6, amp: 0.2 }))), silencio(0.1)), ruido(Math.floor(0.95 * SR), 0.003))
      const ons = simular(s, proc).filter((x) => x.e.tipo === 'on').map((x) => x.e.midi).sort((a, b) => a - b)
      total++
      if (JSON.stringify(ons) === JSON.stringify(notas)) ok++
    }
    RESULTADOS.acorde_processador = { acertos: ok, total }
    expect(ok).toBeGreaterThanOrEqual(6)
  })

  it('grava os números', () => {
    mkdirSync('tests/resultados', { recursive: true })
    writeFileSync('tests/resultados/microfone.json', JSON.stringify(RESULTADOS, null, 2))
  })
})
