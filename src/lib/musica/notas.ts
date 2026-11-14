// Nomes de notas e descrição de intervalos (funções puras).

export type EstiloNome = 'do' | 'c'

const NOMES_DO = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si']
const NOMES_C = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const MIDI_MIN = 36 // C2, primeira tecla do CT-S300
export const MIDI_MAX = 96 // C7, última tecla
export const DO_CENTRAL = 60

export function oitava(midi: number): number {
  return Math.floor(midi / 12) - 1
}

/** "Dó", "Ré#"… ou "C", "D#"… (sem oitava). */
export function nome(midi: number, estilo: EstiloNome = 'do'): string {
  const i = ((midi % 12) + 12) % 12
  return estilo === 'c' ? NOMES_C[i] : NOMES_DO[i]
}

/** "Dó4", "C4"… (Dó central = Dó4 = MIDI 60). */
export function nomeComOitava(midi: number, estilo: EstiloNome = 'do'): string {
  return nome(midi, estilo) + oitava(midi)
}

export function ehPreta(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12)
}

export function frequenciaMidi(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function midiDaFrequencia(f: number): number {
  return 69 + 12 * Math.log2(f / 440)
}

/** Índice da tecla branca (teclas pretas ficam entre duas brancas: +0.5). */
export function indiceBranco(midi: number): number {
  const o = Math.floor(midi / 12)
  const pc = ((midi % 12) + 12) % 12
  const mapa = [0, 0.5, 1, 1.5, 2, 3, 3.5, 4, 4.5, 5, 5.5, 6]
  return o * 7 + mapa[pc]
}

const INTERVALOS: Record<number, string> = {
  1: 'um semitom',
  2: 'um tom',
  3: 'um tom e meio',
  4: 'dois tons',
  5: 'dois tons e meio',
  6: 'três tons',
  7: 'três tons e meio (uma quinta)',
  8: 'quatro tons',
  9: 'quatro tons e meio',
  10: 'cinco tons',
  11: 'cinco tons e meio',
  12: 'uma oitava',
}

/** Distância em palavras: "um tom", "duas oitavas e um semitom"... */
export function distanciaEmPalavras(semitons: number): string {
  const s = Math.abs(semitons)
  if (s === 0) return 'a mesma nota'
  if (s <= 12) return INTERVALOS[s]
  const oit = Math.floor(s / 12)
  const resto = s % 12
  const txtOit = oit === 1 ? 'uma oitava' : `${oit} oitavas`
  return resto === 0 ? txtOit : `${txtOit} e ${INTERVALOS[resto]}`
}

/**
 * Explica o erro em português simples, ex.:
 * "Você tocou Ré, a nota certa é Mi — um tom acima."
 */
export function explicarErro(tocada: number, esperadas: number[], estilo: EstiloNome = 'do'): string {
  if (!esperadas.length) return `Você tocou ${nome(tocada, estilo)}, mas agora não é para tocar nada.`
  // nota esperada mais próxima da tocada
  const alvo = esperadas.reduce((a, b) => (Math.abs(b - tocada) < Math.abs(a - tocada) ? b : a))
  const dif = alvo - tocada
  const dir = dif > 0 ? 'acima' : 'abaixo'
  if (esperadas.length > 1) {
    const acorde = [...esperadas].sort((a, b) => a - b).map((n) => nome(n, estilo)).join('–')
    if (dif % 12 === 0) {
      return `Você tocou ${nome(tocada, estilo)} na oitava errada. O acorde é ${acorde}: procure ${nome(alvo, estilo)} ${distanciaEmPalavras(dif)} ${dir}.`
    }
    return `Você tocou ${nome(tocada, estilo)}, mas o acorde é ${acorde}. A nota mais perto é ${nome(alvo, estilo)} — ${distanciaEmPalavras(dif)} ${dir}.`
  }
  if (dif % 12 === 0) {
    return `Você tocou ${nome(tocada, estilo)} na oitava errada: a nota certa é ${distanciaEmPalavras(dif)} ${dir}.`
  }
  return `Você tocou ${nome(tocada, estilo)}, a nota certa é ${nome(alvo, estilo)} — ${distanciaEmPalavras(dif)} ${dir}.`
}
