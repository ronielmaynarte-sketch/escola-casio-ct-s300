import { describe, expect, it } from 'vitest'
import { MUSICAS_EMBUTIDAS } from '../../src/lib/musica/catalogo'
import { NIVEIS } from '../../src/lib/musica/tipos'
import { gerarPassos, licoesDaMusica } from '../../src/lib/musica/passos'
import { nomeComOitava } from '../../src/lib/musica/notas'

const PROIBIDAS = /gonzaga|asa branca|river flows|comptine|my heart|imagine|hallelujah|parab[eé]ns/i

describe('biblioteca embutida', () => {
  it('tem as 13 músicas de domínio público pedidas', () => {
    const ids = MUSICAS_EMBUTIDAS.map((m) => m.id).sort()
    expect(ids).toEqual([
      'atirei-o-pau-no-gato', 'brilha-estrelinha', 'canon-pachelbel', 'ciranda-cirandinha', 'fur-elise', 'greensleeves', 'jingle-bells',
      'marcha-nupcial-wagner', 'marcha-turca', 'minueto-sol', 'ode-alegria', 'preludio-bwv846', 'sonata-ao-luar',
    ])
    for (const m of MUSICAS_EMBUTIDAS) expect(m.titulo).not.toMatch(PROIBIDAS)
  })

  for (const m of MUSICAS_EMBUTIDAS) {
    describe(m.titulo, () => {
      it('todas as notas cabem nas 61 teclas (36–96), com dedo 1–5', () => {
        for (const nv of NIVEIS) {
          expect(m.niveis[nv].length).toBeGreaterThan(0)
          for (const n of m.niveis[nv]) {
            expect(n.midi).toBeGreaterThanOrEqual(36)
            expect(n.midi).toBeLessThanOrEqual(96)
            expect(n.dedo).toBeGreaterThanOrEqual(1)
            expect(n.dedo).toBeLessThanOrEqual(5)
          }
        }
      })
      it('fácil = só mão direita; intermediário e avançado têm mão esquerda', () => {
        expect(m.niveis.facil.every((n) => n.mao === 'direita')).toBe(true)
        expect(m.niveis.intermediario.some((n) => n.mao === 'esquerda')).toBe(true)
        expect(m.niveis.avancado.some((n) => n.mao === 'esquerda')).toBe(true)
        // a melodia da mão direita é a mesma nos três níveis (só muda o acompanhamento)
        const md = (nv: 'facil' | 'intermediario') => m.niveis[nv].filter((n) => n.mao === 'direita').map((n) => `${n.midi}@${n.inicio}`).join(',')
        expect(md('intermediario')).toBe(md('facil'))
      })
      it('as frases fecham em compassos inteiros (exceto anacruse)', () => {
        const bpc = m.compasso[0]
        const fim = m.secoes[m.secoes.length - 1].fim
        // músicas que começam com anacruse de 1 batida
        const anacruse: Record<string, number> = { 'fur-elise': 1, greensleeves: 1, 'marcha-turca': 1 }
        if (!m.ritmoAproximado) expect((fim - (anacruse[m.id] ?? 0)) % bpc).toBeCloseTo(0, 3)
      })
      it('gera passos e as 6 lições', () => {
        const p = gerarPassos(m, 'avancado', { maos: 'juntas' })
        expect(p.length).toBeGreaterThan(5)
        const l = licoesDaMusica(m, 'intermediario')
        expect(l.map((x) => x.id)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6'])
        for (const x of l) for (const t of x.plano.trechos) expect(gerarPassos(m, t.nivel, { maos: t.maos, inicio: t.inicio, fim: t.fim }).length).toBeGreaterThan(0)
      })
    })
  }

  it('melodias de referência (conferência nota a nota)', () => {
    const mel = (id: string, n: number) =>
      MUSICAS_EMBUTIDAS.find((m) => m.id === id)!.niveis.facil.slice(0, n).map((x) => nomeComOitava(x.midi, 'c')).join(' ')
    expect(mel('fur-elise', 9)).toBe('E5 D#5 E5 D#5 E5 B4 D5 C5 A4')
    expect(mel('ode-alegria', 8)).toBe('E4 E4 F4 G4 G4 F4 E4 D4')
    expect(mel('brilha-estrelinha', 7)).toBe('C4 C4 G4 G4 A4 A4 G4')
    expect(mel('marcha-turca', 9)).toBe('B4 A4 G#4 A4 C5 D5 C5 B4 C5')
    expect(mel('jingle-bells', 11)).toBe('E4 E4 E4 E4 E4 E4 E4 G4 C4 D4 E4')
    expect(mel('marcha-nupcial-wagner', 8)).toBe('G4 C5 C5 C5 G4 D5 B4 C5')
    expect(mel('atirei-o-pau-no-gato', 9)).toBe('G4 F4 E4 D4 E4 F4 G4 G4 G4')
    expect(mel('ciranda-cirandinha', 7)).toBe('D4 G4 G4 B4 B4 D5 D5')
    expect(mel('minueto-sol', 6)).toBe('D5 G4 A4 B4 C5 D5')
    expect(mel('greensleeves', 6)).toBe('A4 C5 D5 E5 F5 E5')
    expect(mel('canon-pachelbel', 8)).toBe('F#5 E5 D5 C#5 B4 A4 B4 C#5')
    expect(mel('sonata-ao-luar', 3)).toBe('G#3 C#4 E4')
    expect(mel('preludio-bwv846', 6)).toBe('G4 C5 E5 G4 C5 E5')
  })
})
