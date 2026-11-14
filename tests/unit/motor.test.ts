import { describe, expect, it } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { MUSICAS_EMBUTIDAS } from '../../src/lib/musica/catalogo'
import { MotorTocar } from '../../src/lib/musica/motor'
import { licoesDaMusica, planoDoModo } from '../../src/lib/musica/passos'
import { MODOS, NIVEIS } from '../../src/lib/musica/tipos'
import type { Modo, Nivel } from '../../src/lib/musica/tipos'
import { explicarErro } from '../../src/lib/musica/notas'

const musica = (id: string) => MUSICAS_EMBUTIDAS.find((m) => m.id === id)!

/** Toca o passo atual corretamente (todas as notas juntas) e solta. */
function tocarCerto(m: MotorTocar, t: number) {
  const p = m.passoAtual!
  let r
  for (const n of p.notas) r = m.noteOn(n.midi, t)
  for (const n of p.notas) m.noteOff(n.midi)
  return r!
}

function tocarTudo(m: MotorTocar, msEntre = 300) {
  let t = 1000
  let guarda = 0
  while (!m.terminou && guarda++ < 20000) {
    tocarCerto(m, t)
    t += msEntre
  }
  return t
}

describe('motor do modo espera — todas as músicas × modos × níveis', () => {
  const tabela: string[] = []
  for (const mu of MUSICAS_EMBUTIDAS) {
    it(`${mu.titulo}: tocar certo em todos os modos/níveis termina com 100%`, () => {
      for (const nv of NIVEIS) {
        for (const modo of MODOS) {
          const plano = planoDoModo(mu, nv, modo)
          const m = new MotorTocar(mu, plano)
          const total = m.passosDoTrecho.length
          expect(total).toBeGreaterThan(0)
          tocarTudo(m)
          const r = m.resultado()
          expect(m.terminou).toBe(true)
          expect(r.erradas).toBe(0)
          expect(r.pontuacao).toBe(100)
          if (modo === 'desafio') expect(plano.ocultarDicas).toBe(true)
          tabela.push(`${mu.id} ${nv} ${modo}: ${r.corretas} notas ok`)
        }
      }
    })
  }
  it('grava a tabela', () => {
    mkdirSync('tests/resultados', { recursive: true })
    writeFileSync('tests/resultados/motor-modos.txt', tabela.join('\n'))
  })
})

describe('regras do professor', () => {
  it('nota errada: vermelho, mensagem explicando e NÃO avança', () => {
    const mu = musica('ode-alegria')
    const m = new MotorTocar(mu, planoDoModo(mu, 'facil', 'direita'))
    expect(m.passoAtual!.notas[0].midi).toBe(64) // Mi
    const r = m.noteOn(62, 1000) // Ré
    expect(r.tipo).toBe('erro')
    expect(r.mensagem).toBe('Você tocou Ré, a nota certa é Mi — um tom acima.')
    expect(m.indicePasso).toBe(0)
    m.noteOff(62)
    expect(m.noteOn(64, 1500).tipo).toBe('acerto')
    expect(m.indicePasso).toBe(1)
    expect(m.resultado().erradas).toBe(1)
  })

  it('mensagens de erro: oitava errada, semitom, abaixo', () => {
    expect(explicarErro(76, [64])).toBe('Você tocou Mi na oitava errada: a nota certa é uma oitava abaixo.')
    expect(explicarErro(61, [60])).toBe('Você tocou Dó#, a nota certa é Dó — um semitom abaixo.')
    expect(explicarErro(65, [60, 64, 67])).toMatch(/acorde é Dó–Mi–Sol/)
  })

  it('nota repetida precisa ser tocada de novo (não vale segurar)', () => {
    const mu = musica('ode-alegria') // começa Mi Mi
    const m = new MotorTocar(mu, planoDoModo(mu, 'facil', 'direita'))
    m.noteOn(64, 1000)
    expect(m.indicePasso).toBe(1)
    // sem soltar e apertar de novo, não avança
    expect(m.indicePasso).toBe(1)
    m.noteOff(64)
    m.noteOn(64, 1400)
    expect(m.indicePasso).toBe(2)
  })

  it('acorde: completa só com todas as notas seguradas juntas (janela de 150 ms)', () => {
    const mu = musica('canon-pachelbel')
    const m = new MotorTocar(mu, planoDoModo(mu, 'avancado', 'esquerda'))
    const p = m.passoAtual!
    expect(p.notas.map((n) => n.midi)).toEqual([50, 57]) // Ré3 + Lá3
    expect(m.noteOn(50, 1000).tipo).toBe('parcial')
    expect(m.noteOn(57, 1400).tipo).toBe('acorde_separado') // 400 ms depois: separado demais
    expect(m.indicePasso).toBe(0)
    m.noteOff(50)
    m.noteOff(57)
    m.noteOn(50, 2000)
    expect(m.noteOn(57, 2080).tipo).toBe('acerto')
    expect(m.indicePasso).toBe(1)
  })

  it('acorde: soltar uma nota antes de completar não conta', () => {
    const mu = musica('canon-pachelbel')
    const m = new MotorTocar(mu, planoDoModo(mu, 'avancado', 'esquerda'))
    m.noteOn(50, 1000)
    m.noteOff(50)
    expect(m.noteOn(57, 1050).tipo).toBe('parcial')
    expect(m.indicePasso).toBe(0)
  })

  it('modo de uma mão: notas do outro lado da divisão são ignoradas (não contam erro)', () => {
    const mu = musica('ode-alegria')
    const m = new MotorTocar(mu, planoDoModo(mu, 'intermediario', 'direita'))
    expect(m.noteOn(48, 1000).tipo).toBe('ignorada')
    expect(m.resultado().erradas).toBe(0)
  })

  it('eco do microfone (repique da nota anterior em <120 ms) é ignorado', () => {
    const mu = musica('brilha-estrelinha') // Dó Dó Sol
    const m = new MotorTocar(mu, planoDoModo(mu, 'facil', 'direita'))
    m.noteOn(60, 1000)
    m.noteOff(60)
    m.noteOn(60, 1300)
    m.noteOff(60)
    expect(m.indicePasso).toBe(2) // agora espera Sol
    expect(m.noteOn(60, 1350).tipo).toBe('ignorada')
    expect(m.noteOn(60, 1600).tipo).toBe('erro')
  })

  it('mãos separadas: direita, depois esquerda, depois juntas em cada frase', () => {
    const mu = musica('brilha-estrelinha')
    const p = planoDoModo(mu, 'intermediario', 'separadas')
    expect(p.trechos.slice(0, 3).map((t) => t.maos)).toEqual(['direita', 'esquerda', 'juntas'])
    expect(p.trechos.length).toBe(mu.secoes.length * 3)
  })

  it('modo fácil: só a melodia e mais devagar', () => {
    const mu = musica('fur-elise')
    const p = planoDoModo(mu, 'avancado', 'facil')
    expect(p.velocidadeSugerida).toBe(0.7)
    const m = new MotorTocar(mu, p)
    expect(m.passosDoTrecho.every((x) => x.notas.length === 1 && x.notas[0].mao === 'direita')).toBe(true)
  })

  it('reforço automático: frase com 3+ erros entra na fila de novo', () => {
    const mu = musica('brilha-estrelinha')
    const m = new MotorTocar(mu, planoDoModo(mu, 'facil', 'direita'))
    let t = 1000
    // 3 erros na primeira frase
    for (let i = 0; i < 3; i++) m.noteOn(95, (t += 100))
    const trechosAntes = m.totalTrechos
    let fimTrecho = null
    while (!m.terminou) {
      const r = tocarCerto(m, (t += 300))
      if (r.repeticao) fimTrecho = r
    }
    expect(m.totalTrechos).toBe(trechosAntes + 1)
    expect(fimTrecho!.repeticao).toMatch(/reforçar: Frase 1/)
    expect(m.resultado().trechosRepetidos).toBe(1)
  })

  it('lição L2 "repetir até acertar": repete enquanto houver erro', () => {
    const mu = musica('ode-alegria')
    const l2 = licoesDaMusica(mu, 'facil')[1]
    const m = new MotorTocar(mu, l2.plano, { repetirTrechosDificeis: false })
    let t = 1000
    m.noteOn(90, t) // 1 erro
    while (m.indiceTrecho === 0) tocarCerto(m, (t += 300))
    expect(m.terminou).toBe(false)
    expect(m.tentativa).toBe(2)
    tocarTudo(m)
    expect(m.terminou).toBe(true)
  })

  it('lições L1–L6 seguem a ordem pedida', () => {
    const l = licoesDaMusica(musica('greensleeves'), 'intermediario')
    expect(l.map((x) => x.plano.trechos[0].maos)).toEqual(['direita', 'direita', 'direita', 'esquerda', 'juntas', 'juntas'])
    expect(l[1].plano.trechos[0].repetirAteAcertar).toBe(true)
    expect(l[5].plano.trechos[0].fim).toBe(musica('greensleeves').secoes.at(-1)!.fim)
  })

  it('ritmo: perfeito / bom / adiantado / atrasado e precisão', () => {
    const mu = musica('ode-alegria') // bpm 100 -> 600 ms por batida (velocidade 1)
    const m = new MotorTocar(mu, planoDoModo(mu, 'facil', 'direita'), { ritmo: true, velocidade: 1 })
    m.iniciar(0)
    const mpb = m.msPorBatida
    expect(mpb).toBe(600)
    const js: string[] = []
    const desvios = [0, 20, -100, 250, -250] // perfeito, perfeito, bom, atrasado, adiantado
    let base = 0
    for (let i = 0; i < desvios.length; i++) {
      const p = m.passoAtual!
      const prev = i === 0 ? 0 : base
      const tEsperado = i === 0 ? 0 : prev + (p.t - ultimoT) * mpb
      const tReal = tEsperado + desvios[i]
      const r = m.noteOn(p.notas[0].midi, tReal)
      m.noteOff(p.notas[0].midi)
      js.push(r.julgamento!)
      base = tReal
      ultimoT = p.t
    }
    expect(js).toEqual(['perfeito', 'perfeito', 'bom', 'atrasado', 'adiantado'])
    m.encerrar(5000)
    const r = m.resultado()
    expect(r.ritmo!.perfeito).toBe(2)
    expect(r.ritmo!.precisao).toBe(Math.round((100 * (2 + 0.7)) / 5))
  })
  let ultimoT = 0

  it('velocidade muda o tempo esperado (40%–120%)', () => {
    const mu = musica('ode-alegria')
    expect(new MotorTocar(mu, planoDoModo(mu, 'facil', 'direita'), { velocidade: 0.5 }).msPorBatida).toBe(1200)
    expect(new MotorTocar(mu, planoDoModo(mu, 'facil', 'direita'), { velocidade: 1.2 }).msPorBatida).toBe(500)
  })

  it('avaliação: pontos a melhorar citam compasso e nota', () => {
    const mu = musica('ode-alegria')
    const m = new MotorTocar(mu, planoDoModo(mu, 'facil', 'direita'), { repetirTrechosDificeis: false })
    m.noteOn(62, 1000) // esperava Mi, tocou Ré (compasso 1)
    m.noteOff(62)
    m.noteOn(62, 1100)
    tocarTudo(m)
    const r = m.resultado()
    expect(r.erradas).toBe(2)
    expect(r.precisaoNotas).toBe(Math.round((100 * r.corretas) / (r.corretas + 2)))
    expect(r.pontosAMelhorar[0]).toMatch(/Compasso 1 \(Frase 1\): 2 erros — atenção em Mi \(tocou Ré\)/)
    expect(r.errosPorCompasso[1]).toBe(2)
  })

  it('níveis diferentes têm quantidades diferentes de notas (fácil < intermediário < avançado)', () => {
    for (const mu of MUSICAS_EMBUTIDAS) {
      const n = (nv: Nivel, modo: Modo = 'juntas') => new MotorTocar(mu, planoDoModo(mu, nv, modo)).passosDoTrecho.reduce((s, p) => s + p.notas.length, 0)
      expect(n('facil', 'direita')).toBeLessThan(n('intermediario'))
      expect(n('intermediario')).toBeLessThanOrEqual(n('avancado'))
    }
  })
})
