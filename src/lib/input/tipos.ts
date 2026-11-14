// Interface comum das fontes de entrada (microfone, MIDI, toque na tela).

export type FonteEntrada = 'microfone' | 'midi' | 'toque' | 'teste'

export interface EventoNota {
  tipo: 'on' | 'off'
  midi: number
  velocidade: number
  fonte: FonteEntrada
  /** performance.now() em ms */
  t: number
}

export type OuvinteNota = (e: EventoNota) => void
