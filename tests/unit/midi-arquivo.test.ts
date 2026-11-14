import { describe, expect, it } from 'vitest'
import { gravarArquivoMidi, lerArquivoMidi } from '../../src/lib/musica/midiArquivo'
import { encaixarNoTeclado, importarMidi, importarTexto } from '../../src/lib/musica/importar'
import { lerMensagemMidi } from '../../src/lib/input/webmidi'
import { gerarPassos } from '../../src/lib/musica/passos'

describe('leitor de arquivo MIDI (gerado no teste)', () => {
  it('tipo 0: notas, duração, andamento e compasso', () => {
    const bytes = gravarArquivoMidi({
      divisao: 480,
      usPorSeminima: 600000,
      compasso: [3, 4],
      faixas: [{ nome: 'Melodia', notas: [60, 62, 64, 65].map((m, i) => ({ midi: m, inicioTick: i * 480, durTick: 400 })) }],
    })
    const a = lerArquivoMidi(bytes)
    expect(a.formato).toBe(0)
    expect(a.divisao).toBe(480)
    expect(a.tempos[0].usPorSeminima).toBe(600000)
    expect(a.compasso).toEqual([3, 4])
    expect(a.faixas[0].nome).toBe('Melodia')
    expect(a.faixas[0].notas.map((n) => [n.midi, n.inicioTick, n.durTick])).toEqual([
      [60, 0, 400], [62, 480, 400], [64, 960, 400], [65, 1440, 400],
    ])
  })

  it('tipo 1 com várias faixas, running status e note-on velocidade 0 como note-off', () => {
    const bytes = gravarArquivoMidi({
      runningStatus: true,
      faixas: [
        { nome: 'Direita', notas: [{ midi: 72, inicioTick: 0, durTick: 240 }, { midi: 74, inicioTick: 240, durTick: 240 }] },
        { nome: 'Esquerda', canal: 1, notas: [{ midi: 48, inicioTick: 0, durTick: 480 }, { midi: 52, inicioTick: 0, durTick: 480 }] },
      ],
    })
    const a = lerArquivoMidi(bytes)
    expect(a.formato).toBe(1)
    expect(a.faixas.length).toBe(3) // faixa de andamento + 2
    const dir = a.faixas.find((f) => f.nome === 'Direita')!
    const esq = a.faixas.find((f) => f.nome === 'Esquerda')!
    expect(dir.notas.map((n) => n.midi)).toEqual([72, 74])
    expect(esq.notas.map((n) => [n.midi, n.durTick])).toEqual([[48, 480], [52, 480]])
    expect(esq.canais).toEqual([1])
  })

  it('rejeita arquivo que não é MIDI', () => {
    expect(() => lerArquivoMidi(new TextEncoder().encode('hello world, not midi'))).toThrow(/MIDI/)
  })

  it('importa: escolhe faixas por mão, quantiza, transpõe para 36–96 e cria seções e níveis', () => {
    // melodia uma oitava acima do teclado (C8 = 108) e levemente fora do tempo
    const bytes = gravarArquivoMidi({
      divisao: 480,
      faixas: [
        { nome: 'Melodia', notas: Array.from({ length: 16 }, (_, i) => ({ midi: 96 + (i % 5), inicioTick: i * 480 + (i % 2 ? 13 : -7 + 7), durTick: 450 })) },
        { nome: 'Baixo', notas: Array.from({ length: 4 }, (_, i) => ({ midi: 36 + 12, inicioTick: i * 1920, durTick: 1900 })) },
      ],
    })
    const arq = lerArquivoMidi(bytes)
    const { musica, avisos } = importarMidi(arq, { titulo: 'Teste', categoria: 'moderno', separacao: 'faixas', faixaDireita: 1, faixaEsquerda: 2, quantizacao: 0.25, compassosPorSecao: 2 })
    const todas = Object.values(musica.niveis).flat()
    expect(todas.every((n) => n.midi >= 36 && n.midi <= 96)).toBe(true)
    expect(avisos.some((a) => /oitava/.test(a.texto))).toBe(true)
    expect(musica.niveis.avancado.filter((n) => n.mao === 'direita').every((n) => Number.isInteger(n.inicio))).toBe(true)
    expect(musica.secoes.length).toBe(2)
    expect(musica.niveis.facil.every((n) => n.mao === 'direita')).toBe(true)
    expect(musica.niveis.intermediario.filter((n) => n.mao === 'esquerda').length).toBe(4)
    expect(gerarPassos(musica, 'avancado', { maos: 'juntas' }).length).toBe(16)
    expect(musica.bpm).toBe(120)
  })

  it('importa separando por altura (ponto de divisão)', () => {
    const bytes = gravarArquivoMidi({ faixas: [{ notas: [{ midi: 48, inicioTick: 0, durTick: 480 }, { midi: 64, inicioTick: 0, durTick: 480 }, { midi: 67, inicioTick: 480, durTick: 480 }] }] })
    const { musica } = importarMidi(lerArquivoMidi(bytes), { titulo: 'x', categoria: 'gonzaga', separacao: 'altura', divisao: 60 })
    const av = musica.niveis.avancado
    expect(av.find((n) => n.midi === 48)!.mao).toBe('esquerda')
    expect(av.find((n) => n.midi === 64)!.mao).toBe('direita')
  })

  it('encaixa notas no teclado', () => {
    const { desloc, mapa } = encaixarNoTeclado([100, 104, 107])
    expect(desloc).toBe(-12)
    expect(mapa(30)).toBe(42)
  })

  it('importa a notação de texto', () => {
    const m = importarTexto('titulo: Escala\nbpm: 80\ncompasso: 4/4\nsecao: A\nmd: C4:1 D4 E4 F4 | G4:4\nme: C3:4 | G2:4\nsecao: B\nmd: Sol4:2 Mi4 | Do4:4\nharmonia: C:4 C', 'importadas')
    expect(m.titulo).toBe('Escala')
    expect(m.secoes.map((s) => s.nome)).toEqual(['A', 'B'])
    expect(m.niveis.facil.map((n) => n.midi)).toEqual([60, 62, 64, 65, 67, 67, 64, 60])
    expect(m.niveis.intermediario.filter((n) => n.mao === 'esquerda').map((n) => n.midi)).toEqual([48, 43, 48, 48])
    expect(() => importarTexto('md: C9:1', 'importadas')).toThrow()
  })
})

describe('mensagens Web MIDI', () => {
  it('note on/off, incluindo velocidade 0', () => {
    expect(lerMensagemMidi([0x90, 60, 100])).toEqual({ tipo: 'on', midi: 60, velocidade: 100, canal: 0 })
    expect(lerMensagemMidi([0x93, 60, 0])).toEqual({ tipo: 'off', midi: 60, velocidade: 0, canal: 3 })
    expect(lerMensagemMidi([0x80, 61, 64])!.tipo).toBe('off')
    expect(lerMensagemMidi([0xb0, 64, 127])).toBeNull()
    expect(lerMensagemMidi([0xfe])).toBeNull()
  })
})
