// Leitor (e gravador, usado nos testes) de arquivos MIDI padrão (SMF tipo 0 e 1). Escrito à mão, sem dependências.

export interface NotaMidi {
  midi: number
  inicioTick: number
  durTick: number
  vel: number
  canal: number
}

export interface FaixaMidi {
  indice: number
  nome: string
  notas: NotaMidi[]
  canais: number[]
}

export interface ArquivoMidi {
  formato: number
  /** ticks por semínima */
  divisao: number
  faixas: FaixaMidi[]
  /** mudanças de andamento: microssegundos por semínima */
  tempos: { tick: number; usPorSeminima: number }[]
  compasso: [number, number] | null
}

export class ErroMidi extends Error {}

class Leitor {
  pos = 0
  constructor(private d: Uint8Array) {}
  get fim(): boolean {
    return this.pos >= this.d.length
  }
  u8(): number {
    if (this.pos >= this.d.length) throw new ErroMidi('Arquivo MIDI terminou antes do esperado.')
    return this.d[this.pos++]
  }
  u16(): number {
    return (this.u8() << 8) | this.u8()
  }
  u32(): number {
    return ((this.u8() << 24) >>> 0) + (this.u8() << 16) + (this.u8() << 8) + this.u8()
  }
  txt(n: number): string {
    let s = ''
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.u8())
    return s
  }
  vlq(): number {
    let v = 0
    for (let i = 0; i < 4; i++) {
      const b = this.u8()
      v = (v << 7) | (b & 0x7f)
      if (!(b & 0x80)) return v
    }
    throw new ErroMidi('Número de tamanho variável inválido.')
  }
  bytes(n: number): Uint8Array {
    if (this.pos + n > this.d.length) throw new ErroMidi('Bloco MIDI cortado.')
    const b = this.d.subarray(this.pos, this.pos + n)
    this.pos += n
    return b
  }
}

export function lerArquivoMidi(dados: ArrayBuffer | Uint8Array): ArquivoMidi {
  const d = dados instanceof Uint8Array ? dados : new Uint8Array(dados)
  const r = new Leitor(d)
  if (d.length < 14 || r.txt(4) !== 'MThd') throw new ErroMidi('Isto não parece um arquivo MIDI (.mid).')
  const tamCab = r.u32()
  const formato = r.u16()
  const nFaixas = r.u16()
  const divisao = r.u16()
  r.pos = 8 + tamCab
  if (formato > 2) throw new ErroMidi(`Formato MIDI ${formato} não suportado.`)
  if (divisao & 0x8000) throw new ErroMidi('Arquivos MIDI com tempo SMPTE não são suportados.')
  if (!divisao) throw new ErroMidi('Divisão de tempo inválida.')
  const faixas: FaixaMidi[] = []
  const tempos: ArquivoMidi['tempos'] = []
  let compasso: [number, number] | null = null

  for (let f = 0; f < nFaixas && !r.fim; f++) {
    const id = r.txt(4)
    const tam = r.u32()
    if (id !== 'MTrk') {
      r.pos += tam
      f--
      continue
    }
    const fimFaixa = r.pos + tam
    const tr = new Leitor(r.bytes(tam))
    r.pos = fimFaixa
    let tick = 0
    let status = 0
    let nome = ''
    const abertas = new Map<number, { inicio: number; vel: number }[]>()
    const notas: NotaMidi[] = []
    const canais = new Set<number>()
    const fechar = (canal: number, nota: number) => {
      const k = canal * 128 + nota
      const lst = abertas.get(k)
      const ab = lst?.shift()
      if (ab) notas.push({ midi: nota, inicioTick: ab.inicio, durTick: Math.max(1, tick - ab.inicio), vel: ab.vel, canal })
    }
    while (!tr.fim) {
      tick += tr.vlq()
      let b = tr.u8()
      if (b === 0xff) {
        const tipo = tr.u8()
        const len = tr.vlq()
        const dados = tr.bytes(len)
        if (tipo === 0x51 && len === 3) tempos.push({ tick, usPorSeminima: (dados[0] << 16) | (dados[1] << 8) | dados[2] })
        else if (tipo === 0x58 && len >= 2 && !compasso) compasso = [dados[0], Math.pow(2, dados[1])]
        else if (tipo === 0x03 && !nome) nome = new TextDecoder('latin1').decode(dados).trim()
        else if (tipo === 0x2f) break
        continue
      }
      if (b === 0xf0 || b === 0xf7) {
        tr.bytes(tr.vlq())
        continue
      }
      let d1: number
      if (b & 0x80) {
        status = b
        d1 = tr.u8()
      } else {
        if (!status) throw new ErroMidi('Evento MIDI sem status (running status inválido).')
        d1 = b
        b = status
      }
      const tipo = status & 0xf0
      const canal = status & 0x0f
      if (tipo === 0xc0 || tipo === 0xd0) continue // 1 byte de dados
      const d2 = tr.u8()
      if (tipo === 0x90 && d2 > 0) {
        if (canal === 9) continue // bateria (canal 10) não entra
        const k = canal * 128 + d1
        if (!abertas.has(k)) abertas.set(k, [])
        abertas.get(k)!.push({ inicio: tick, vel: d2 })
        canais.add(canal)
      } else if (tipo === 0x80 || (tipo === 0x90 && d2 === 0)) {
        fechar(canal, d1)
      }
    }
    // notas sem note-off: fecham no fim da faixa
    for (const [k, lst] of abertas) for (const ab of lst) notas.push({ midi: k % 128, inicioTick: ab.inicio, durTick: Math.max(1, tick - ab.inicio), vel: ab.vel, canal: Math.floor(k / 128) })
    notas.sort((a, b) => a.inicioTick - b.inicioTick || a.midi - b.midi)
    faixas.push({ indice: faixas.length, nome: nome || `Faixa ${faixas.length + 1}`, notas, canais: [...canais] })
  }
  tempos.sort((a, b) => a.tick - b.tick)
  return { formato, divisao, faixas, tempos, compasso }
}

// ---------- gravação (para testes e exportação) ----------

function vlq(n: number): number[] {
  const out = [n & 0x7f]
  n >>>= 7
  while (n > 0) {
    out.unshift((n & 0x7f) | 0x80)
    n >>>= 7
  }
  return out
}

export interface FaixaParaGravar {
  nome?: string
  canal?: number
  notas: { midi: number; inicioTick: number; durTick: number; vel?: number }[]
}

export function gravarArquivoMidi(op: {
  divisao?: number
  usPorSeminima?: number
  compasso?: [number, number]
  faixas: FaixaParaGravar[]
  /** usa running status e note-on com velocidade 0 como note-off */
  runningStatus?: boolean
}): Uint8Array {
  const divisao = op.divisao ?? 480
  const blocos: number[][] = []
  const cab = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, op.faixas.length > 1 ? 1 : 0, 0, op.faixas.length + (op.faixas.length > 1 ? 1 : 0), divisao >> 8, divisao & 0xff]
  const meta: number[] = []
  const us = op.usPorSeminima ?? 500000
  meta.push(...vlq(0), 0xff, 0x51, 3, (us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff)
  if (op.compasso) meta.push(...vlq(0), 0xff, 0x58, 4, op.compasso[0], Math.log2(op.compasso[1]), 24, 8)
  const faixaBytes = (f: FaixaParaGravar, extra: number[]): number[] => {
    const ev: { t: number; on: boolean; midi: number; vel: number }[] = []
    for (const n of f.notas) {
      ev.push({ t: n.inicioTick, on: true, midi: n.midi, vel: n.vel ?? 90 })
      ev.push({ t: n.inicioTick + n.durTick, on: false, midi: n.midi, vel: 0 })
    }
    ev.sort((a, b) => a.t - b.t || Number(a.on) - Number(b.on))
    const out: number[] = [...extra]
    if (f.nome) {
      const nb = [...f.nome].map((c) => c.charCodeAt(0) & 0xff)
      out.push(...vlq(0), 0xff, 0x03, ...vlq(nb.length), ...nb)
    }
    let ultimo = 0
    let st = -1
    const canal = f.canal ?? 0
    for (const e of ev) {
      out.push(...vlq(e.t - ultimo))
      ultimo = e.t
      const status = op.runningStatus ? 0x90 | canal : (e.on ? 0x90 : 0x80) | canal
      if (!op.runningStatus || status !== st) out.push(status)
      st = status
      out.push(e.midi, e.on ? e.vel : op.runningStatus ? 0 : 64)
    }
    out.push(0, 0xff, 0x2f, 0)
    return out
  }
  if (op.faixas.length > 1) {
    blocos.push([...meta, 0, 0xff, 0x2f, 0])
    for (const f of op.faixas) blocos.push(faixaBytes(f, []))
  } else {
    blocos.push(faixaBytes(op.faixas[0], meta))
  }
  const total: number[] = [...cab]
  for (const b of blocos) {
    const n = b.length
    total.push(0x4d, 0x54, 0x72, 0x6b, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff, ...b)
  }
  return new Uint8Array(total)
}
