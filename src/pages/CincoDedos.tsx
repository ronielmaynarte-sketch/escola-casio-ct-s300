import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mic, MicOff, RotateCcw } from 'lucide-react'
import { entrada, useStatusEntrada } from '../lib/input/hub'
import { tocarNota, soltarNota } from '../lib/audio'
import SeloEntrada from '../components/SeloEntrada'

// Aba "5 Teclas": músicas que cabem em Dó-Ré-Mi-Fá-Sol, uma mão só, notas caindo.
const NOMES = ['Dó', 'Ré', 'Mi', 'Fá', 'Sol']
const SEMI = [0, 2, 4, 5, 7]
const CORES = ['bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500']
type Mao = 'direita' | 'esquerda'

// 0=Dó 1=Ré 2=Mi 3=Fá 4=Sol (melodias de domínio público)
const M = (s: string) => s.split(/\s+/).filter(Boolean).map((n) => ['C', 'D', 'E', 'F', 'G'].indexOf(n))
const MUSICAS: { id: string; titulo: string; nivel: string; notas: number[] }[] = [
  { id: 'escala', titulo: 'Escada Dó até Sol', nivel: 'Aquecimento', notas: M('C D E F G G F E D C') },
  { id: 'hot', titulo: 'Pãozinho Quente (Hot Cross Buns)', nivel: 'Muito fácil', notas: M('E D C E D C C C C C D D D D E D C') },
  { id: 'lua', titulo: 'Au Clair de la Lune', nivel: 'Muito fácil', notas: M('C C C D E D C E D D C C C C D E D C E D D C') },
  { id: 'mary', titulo: 'Mary Tinha um Carneirinho', nivel: 'Fácil', notas: M('E D C D E E E D D D E G G E D C D E E E E D D E D C') },
  { id: 'ode', titulo: 'Ode à Alegria (Beethoven)', nivel: 'Fácil', notas: M('E E F G G F E D C C D E E D D E E F G G F E D C C D E D C C') },
  { id: 'barco', titulo: 'Barquinho (Lightly Row)', nivel: 'Fácil', notas: M('G E E F D D C D E F G G G G E E F D D C E G G C') },
  { id: 'jingle', titulo: 'Jingle Bells (refrão)', nivel: 'Médio', notas: M('E E E E E E E G C D E F F F F F E E E E D D E D G E E E E E E E G C D E F F F F F E E E G G F D C') },
]

export default function CincoDedos() {
  const status = useStatusEntrada()
  const [mao, setMao] = useState<Mao>('direita')
  const [musicaId, setMusicaId] = useState<string | null>(null)
  const [pos, setPos] = useState(0)
  const [erroTecla, setErroTecla] = useState<number | null>(null)
  const [acertoTecla, setAcertoTecla] = useState<number | null>(null)
  const [msg, setMsg] = useState('')
  const [erros, setErros] = useState(0)
  const [inicio, setInicio] = useState(0)
  const [fim, setFim] = useState(0)
  const base = mao === 'direita' ? 60 : 48 // Dó central ou Dó uma oitava abaixo
  const musica = MUSICAS.find((m) => m.id === musicaId) ?? null
  const terminou = !!musica && pos >= musica.notas.length
  const esperada = musica && !terminou ? musica.notas[pos] : null
  const dedo = (i: number) => (mao === 'direita' ? i + 1 : 5 - i)

  // o microfone só aceita as 5 teclas e vizinhas próximas; voz é rejeitada no processador
  useEffect(() => {
    entrada.mic.configurar({ faixa: [base - 2, base + 9], rejeitarVoz: true })
    return () => entrada.mic.configurar({ faixa: null })
  }, [base])
  useEffect(() => {
    entrada.setEsperadas(esperada === null ? [] : [base + SEMI[esperada]])
  }, [esperada, base])
  useEffect(() => () => entrada.setEsperadas([]), [])

  useEffect(() => {
    return entrada.ouvir((e) => {
      if (e.tipo !== 'on' || !musica || esperada === null) return
      const idx = SEMI.indexOf(e.midi - base)
      if (e.midi === base + SEMI[esperada]) {
        setAcertoTecla(esperada)
        setErroTecla(null)
        setMsg('')
        if (pos === 0) setInicio(performance.now())
        if (pos + 1 >= musica.notas.length) setFim(performance.now())
        setPos((p) => p + 1)
        setTimeout(() => setAcertoTecla(null), 200)
      } else {
        setErroTecla(idx >= 0 ? idx : null)
        setErros((x) => x + 1)
        setMsg(`Errou: ${idx >= 0 ? `tocou ${NOMES[idx]}` : 'tocou outra tecla'}. A certa é ${NOMES[esperada]} (dedo ${dedo(esperada)}).`)
        setTimeout(() => setErroTecla(null), 600)
      }
    })
  })

  const reiniciar = () => {
    setPos(0)
    setErros(0)
    setMsg('')
    setFim(0)
  }
  const tocar = (i: number, on: boolean) => {
    if (on) tocarNota(base + SEMI[i])
    else soltarNota(base + SEMI[i])
    entrada.toque(base + SEMI[i], on)
  }

  const proximas = useMemo(() => (musica ? musica.notas.slice(pos, pos + 7) : []), [musica, pos])
  const ALT = 56

  if (!musica)
    return (
      <div className="space-y-4" data-testid="cinco-dedos">
        <h1 className="text-xl font-bold">5 Teclas: Dó Ré Mi Fá Sol</h1>
        <p className="text-sm text-slate-400">Músicas para uma mão só, com os 5 dedos parados em cinco teclas vizinhas. Escolha a mão:</p>
        <div className="grid grid-cols-2 gap-2">
          {(['direita', 'esquerda'] as Mao[]).map((m) => (
            <button key={m} onClick={() => setMao(m)} className={`rounded-xl px-3 py-3 text-sm font-semibold ${mao === m ? 'bg-sky-600 text-white' : 'bg-white/5 text-slate-300'}`}>
              Mão {m}
              <span className="block text-[11px] font-normal opacity-80">{m === 'direita' ? 'Dó central até Sol' : 'Dó abaixo do central até Sol'}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {mao === 'direita' ? 'Polegar (1) no Dó central, mindinho (5) no Sol.' : 'Mindinho (5) no Dó, polegar (1) no Sol.'}
        </p>
        <div className="space-y-2">
          {MUSICAS.map((m) => (
            <button key={m.id} onClick={() => { setMusicaId(m.id); reiniciar() }} className="flex w-full items-center justify-between rounded-xl bg-white/[0.04] px-4 py-3 text-left active:bg-white/10">
              <span className="text-sm font-semibold">{m.titulo}</span>
              <span className="text-[11px] text-slate-400">{m.nivel} · {m.notas.length} notas</span>
            </button>
          ))}
        </div>
      </div>
    )

  const precisao = Math.round((musica.notas.length / (musica.notas.length + erros)) * 100)
  return (
    <div className="space-y-3" data-testid="cinco-dedos-tocar">
      <div className="flex items-center justify-between">
        <button onClick={() => setMusicaId(null)} className="flex items-center gap-1 text-sm text-slate-300"><ArrowLeft size={16} /> Músicas</button>
        <button
          onClick={() => (status.microfone === 'ouvindo' ? entrada.desligarMicrofone() : void entrada.ligarMicrofone().catch(() => setMsg('Não consegui ligar o microfone. Permita o acesso nas configurações do Safari.')))}
          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${status.microfone === 'ouvindo' ? 'bg-rose-600 text-white' : 'bg-white/10 text-slate-200'}`}
        >
          {status.microfone === 'ouvindo' ? <Mic size={14} /> : <MicOff size={14} />} {status.microfone === 'ouvindo' ? 'Ouvindo o Casio' : 'Ouvir o Casio'}
        </button>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-semibold text-slate-200">{musica.titulo} · mão {mao}</span>
        <span>{Math.min(pos, musica.notas.length)}/{musica.notas.length} · erros {erros}</span>
      </div>
      <SeloEntrada compacto />
      <div className="h-1.5 overflow-hidden rounded bg-white/10"><div className="h-full bg-sky-500 transition-all" style={{ width: `${(pos / musica.notas.length) * 100}%` }} /></div>

      {terminou ? (
        <div className="space-y-2 rounded-2xl bg-emerald-500/10 p-4 text-center" data-testid="resultado">
          <p className="text-lg font-bold text-emerald-300">Música completa!</p>
          <p className="text-sm text-slate-300">Notas certas: {musica.notas.length} · Erros: {erros} · Precisão: {precisao}%</p>
          <p className="text-sm text-slate-300">Tempo: {Math.max(1, Math.round((fim - inicio) / 1000))} s</p>
          <button onClick={reiniciar} className="mx-auto flex items-center gap-1 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold"><RotateCcw size={14} /> Tocar de novo</button>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-indigo-950 to-slate-900" style={{ height: ALT * 6 }}>
          {[1, 2, 3, 4].map((c) => <div key={c} className="absolute top-0 h-full w-px bg-white/10" style={{ left: `${c * 20}%` }} />)}
          {proximas.map((n, k) => (
            <div
              key={pos + k}
              className={`absolute flex items-center justify-center rounded-lg text-sm font-bold text-white shadow-lg transition-all duration-200 ${CORES[n]} ${k === 0 ? 'ring-2 ring-white' : 'opacity-80'}`}
              style={{ left: `calc(${n * 20}% + 4px)`, width: 'calc(20% - 8px)', height: ALT - 8, bottom: k * ALT + 4 }}
            >
              {NOMES[n]}
            </div>
          ))}
        </div>
      )}
      <p className={`min-h-[1.25rem] text-center text-sm ${msg ? 'text-red-300' : 'text-slate-500'}`} data-testid="msg">
        {msg || (esperada !== null ? `Toque ${NOMES[esperada]} com o dedo ${dedo(esperada)}` : '')}
      </p>

      <div className="grid grid-cols-5 gap-1" data-testid="teclas5">
        {NOMES.map((nome, i) => (
          <button
            key={nome}
            data-testid={`tecla-${i}`}
            onPointerDown={(ev) => { ev.preventDefault(); tocar(i, true) }}
            onPointerUp={() => tocar(i, false)}
            onPointerLeave={() => tocar(i, false)}
            className={`flex h-36 select-none flex-col items-center justify-between rounded-b-xl border border-slate-300 py-2 text-slate-900 transition-colors ${
              erroTecla === i ? 'bg-red-500 text-white' : acertoTecla === i ? 'bg-emerald-400' : esperada === i ? 'bg-sky-200' : 'bg-white'
            }`}
          >
            <span className="text-base font-extrabold">{nome}</span>
            <span className="text-[11px] text-slate-500">dedo {dedo(i)}</span>
          </button>
        ))}
      </div>
      <p className="text-center text-[11px] text-slate-500">
        No Casio: {mao === 'direita' ? 'Dó central (o Dó do meio) até o Sol à direita dele.' : 'o Dó logo abaixo do Dó central até o Sol.'} O microfone ignora voz e só aceita estas teclas.
      </p>
      <Link to="/" className="block text-center text-xs text-slate-500">Voltar ao início</Link>
    </div>
  )
}
