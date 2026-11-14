// Central de entrada: junta microfone, MIDI e toque na tela num só fluxo de eventos noteOn/noteOff.

import { useEffect, useState } from 'react'
import { EntradaMicrofone } from './microfone'
import type { EstadoMic } from './microfone'
import { EntradaMidi, webMidiSuportado } from './webmidi'
import type { EventoNota, FonteEntrada, OuvinteNota } from './tipos'
import { lerConfig } from '../treino/armazenamento'

export type EstadoMidi = 'desligado' | 'pedindo' | 'conectado' | 'sem-dispositivo' | 'negado' | 'nao-suportado'

export interface StatusEntrada {
  microfone: EstadoMic
  micMudo: boolean
  midi: EstadoMidi
  dispositivosMidi: string[]
  /** última fonte que mandou nota */
  ultimaFonte: FonteEntrada | null
}

class EntradaHub {
  private ouvintes = new Set<OuvinteNota>()
  private ouvintesStatus = new Set<() => void>()
  readonly mic: EntradaMicrofone
  readonly midi: EntradaMidi
  private estadoMidi: EstadoMidi = webMidiSuportado() ? 'desligado' : 'nao-suportado'
  private ultimaFonte: FonteEntrada | null = null
  private status: StatusEntrada

  constructor() {
    const c = typeof localStorage !== 'undefined' ? lerConfig() : null
    this.mic = new EntradaMicrofone(
      (e) => this.emitir({ tipo: e.tipo, midi: e.midi, velocidade: 80, fonte: 'microfone', t: performance.now() }),
      () => this.mudou(),
      { ruido: c?.ruidoMic ?? null, sensibilidade: c?.sensibilidadeMic ?? 1, rejeitarVoz: true },
    )
    this.midi = new EntradaMidi(
      (m) => this.emitir({ tipo: m.tipo, midi: m.midi, velocidade: m.velocidade, fonte: 'midi', t: performance.now() }),
      () => {
        if (this.estadoMidi === 'conectado' || this.estadoMidi === 'sem-dispositivo')
          this.estadoMidi = this.midi.dispositivos.length ? 'conectado' : 'sem-dispositivo'
        this.mudou()
      },
    )
    this.status = this.calcular()
  }

  private calcular(): StatusEntrada {
    return {
      microfone: this.mic.estado,
      micMudo: this.mic.mudo,
      midi: this.estadoMidi,
      dispositivosMidi: [...this.midi.dispositivos],
      ultimaFonte: this.ultimaFonte,
    }
  }

  private mudou(): void {
    this.status = this.calcular()
    this.ouvintesStatus.forEach((f) => f())
  }

  getStatus(): StatusEntrada {
    return this.status
  }

  emitir(e: EventoNota): void {
    if (e.tipo === 'on' && this.ultimaFonte !== e.fonte) {
      this.ultimaFonte = e.fonte
      this.mudou()
    }
    this.ouvintes.forEach((f) => f(e))
  }

  /** Teclado da tela. */
  toque(midi: number, ligado: boolean): void {
    this.emitir({ tipo: ligado ? 'on' : 'off', midi, velocidade: 90, fonte: 'toque', t: performance.now() })
  }

  ouvir(f: OuvinteNota): () => void {
    this.ouvintes.add(f)
    return () => this.ouvintes.delete(f)
  }

  ouvirStatus(f: () => void): () => void {
    this.ouvintesStatus.add(f)
    return () => this.ouvintesStatus.delete(f)
  }

  setEsperadas(n: number[]): void {
    this.mic.setEsperadas(n)
  }

  async ligarMicrofone(): Promise<void> {
    const c = lerConfig()
    this.mic.configurar({ ruido: c.ruidoMic, sensibilidade: c.sensibilidadeMic })
    await this.mic.iniciar()
  }

  desligarMicrofone(): void {
    this.mic.parar()
  }

  async ligarMidi(): Promise<void> {
    if (!webMidiSuportado()) {
      this.estadoMidi = 'nao-suportado'
      this.mudou()
      return
    }
    this.estadoMidi = 'pedindo'
    this.mudou()
    try {
      await this.midi.iniciar()
      this.estadoMidi = this.midi.dispositivos.length ? 'conectado' : 'sem-dispositivo'
    } catch {
      this.estadoMidi = 'negado'
    }
    this.mudou()
  }

  desligarMidi(): void {
    this.midi.parar()
    this.estadoMidi = webMidiSuportado() ? 'desligado' : 'nao-suportado'
    this.mudou()
  }
}

export const entrada = new EntradaHub()

export function useStatusEntrada(): StatusEntrada {
  const [s, setS] = useState(entrada.getStatus())
  useEffect(() => entrada.ouvirStatus(() => setS(entrada.getStatus())), [])
  return s
}
