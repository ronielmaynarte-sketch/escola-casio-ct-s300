import { useEffect, useRef, useState } from 'react'
import { Mic, Settings, Usb, Volume2 } from 'lucide-react'
import { entrada, useStatusEntrada } from '../lib/input/hub'
import { webMidiSuportado } from '../lib/input/webmidi'
import { nomeComOitava } from '../lib/musica/notas'
import { useConfig } from '../lib/treino/useConfig'
import type { FontePreferida } from '../lib/treino/armazenamento'
import { Cartao } from '../components/ui'
import SeloEntrada from '../components/SeloEntrada'
import { mensagemMic } from './Tocar'

const FONTES: { id: FontePreferida; nome: string; desc: string }[] = [
  { id: 'auto', nome: 'Automático', desc: 'MIDI se houver cabo; senão, toque/microfone.' },
  { id: 'microfone', nome: 'Microfone', desc: 'Para o iPhone: o celular ouve o CT-S300.' },
  { id: 'midi', nome: 'Teclado USB (MIDI)', desc: 'Android/computador com cabo USB.' },
  { id: 'toque', nome: 'Só a tela', desc: 'Toque as teclas no teclado da tela.' },
]

export default function Configuracoes() {
  const [c, mudar] = useConfig()
  const status = useStatusEntrada()
  return (
    <div className="space-y-6 pt-2" data-testid="configuracoes">
      <header className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10">
          <Settings size={24} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-white">Configurações</h1>
          <p className="text-sm text-slate-400">Entrada, microfone, divisão das mãos e metrônomo.</p>
        </div>
      </header>

      <Cartao className="space-y-3 p-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-amber-400/90">Fonte de entrada</h2>
        <SeloEntrada />
        <div className="grid gap-2 sm:grid-cols-2">
          {FONTES.map((f) => (
            <button key={f.id} type="button" onClick={() => mudar({ fonte: f.id })} className={`rounded-2xl border p-3 text-left ${c.fonte === f.id ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-white/[0.03]'}`} data-testid={`fonte-${f.id}`}>
              <p className="text-sm font-bold text-white">{f.nome}</p>
              <p className="text-[11px] text-slate-400">{f.desc}</p>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => (webMidiSuportado() ? void entrada.ligarMidi() : undefined)}
            disabled={!webMidiSuportado()}
            className="flex h-10 items-center gap-2 rounded-xl bg-violet-500/20 px-3 text-sm font-semibold text-violet-100 disabled:opacity-50"
            data-testid="config-ligar-midi"
          >
            <Usb size={16} /> {webMidiSuportado() ? (status.midi === 'conectado' ? `Conectado: ${status.dispositivosMidi.join(', ')}` : status.midi === 'sem-dispositivo' ? 'Nenhum teclado MIDI ligado — conecte o cabo USB' : 'Procurar teclado MIDI') : 'MIDI não suportado neste navegador'}
          </button>
        </div>
        {!webMidiSuportado() && (
          <p className="text-[11px] text-slate-400" data-testid="midi-nao-suportado">
            Web MIDI não suportado neste navegador. No iPhone (Safari) use o microfone. No Android, use o Chrome com cabo USB OTG ligado no CT-S300.
          </p>
        )}
      </Cartao>

      <Calibracao />

      <Cartao className="space-y-4 p-4 text-sm text-slate-200">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-amber-400/90">Teclado e prática</h2>
        <label className="block">
          Divisão das mãos: a mão direita começa em <strong>{nomeComOitava(c.divisao, c.estiloNome)}</strong>
          <input type="range" min={48} max={72} value={c.divisao} onChange={(e) => mudar({ divisao: Number(e.target.value) })} className="w-full accent-amber-400" data-testid="config-divisao" />
        </label>
        <label className="block">
          <span className="flex items-center gap-2">
            <Volume2 size={15} /> Volume do metrônomo: {Math.round(c.volumeMetronomo * 100)}%
          </span>
          <input type="range" min={0} max={100} value={Math.round(c.volumeMetronomo * 100)} onChange={(e) => mudar({ volumeMetronomo: Number(e.target.value) / 100 })} className="w-full accent-amber-400" />
        </label>
        <label className="block">
          Velocidade padrão: {Math.round(c.velocidadePadrao * 100)}%
          <input type="range" min={40} max={120} step={5} value={Math.round(c.velocidadePadrao * 100)} onChange={(e) => mudar({ velocidadePadrao: Number(e.target.value) / 100 })} className="w-full accent-amber-400" />
        </label>
        <div className="flex items-center justify-between">
          <span>Nome das notas</span>
          <div className="flex gap-1">
            {(['do', 'c'] as const).map((e) => (
              <button key={e} type="button" onClick={() => mudar({ estiloNome: e })} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${c.estiloNome === e ? 'bg-amber-400 text-slate-950' : 'bg-white/10'}`} data-testid={`nome-${e}`}>
                {e === 'do' ? 'Dó Ré Mi' : 'C D E'}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          Janela do acorde (notas juntas): {c.janelaAcordeMs} ms
          <input type="range" min={80} max={400} step={10} value={c.janelaAcordeMs} onChange={(e) => mudar({ janelaAcordeMs: Number(e.target.value) })} className="w-full accent-amber-400" />
        </label>
        <label className="flex items-center justify-between">
          Som do teclado da tela
          <input type="checkbox" checked={c.somDoTeclado} onChange={(e) => mudar({ somDoTeclado: e.target.checked })} className="h-5 w-5 accent-amber-400" />
        </label>
      </Cartao>
    </div>
  )
}

function Calibracao() {
  const [c, mudar] = useConfig()
  const status = useStatusEntrada()
  const [etapa, setEtapa] = useState<'inicio' | 'silencio' | 'teste' | 'ok'>('inicio')
  const [nivel, setNivel] = useState(0)
  const [ouvida, setOuvida] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const raf = useRef<number | null>(null)

  useEffect(() => {
    if (status.microfone !== 'ouvindo') return
    const f = () => {
      setNivel(entrada.mic.nivel)
      raf.current = requestAnimationFrame(f)
    }
    raf.current = requestAnimationFrame(f)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [status.microfone])

  useEffect(
    () =>
      entrada.ouvir((e) => {
        if (e.tipo === 'on' && e.fonte === 'microfone') {
          setOuvida(e.midi)
          if (e.midi === 60) setEtapa('ok')
        }
      }),
    [],
  )

  const ligar = async () => {
    setErro(null)
    try {
      await entrada.ligarMicrofone()
      setEtapa('silencio')
    } catch {
      setErro(mensagemMic(entrada.mic.estado))
    }
  }
  const medir = async () => {
    setErro(null)
    setEtapa('silencio')
    const r = await entrada.mic.medirRuido(2000)
    mudar({ ruidoMic: r })
    entrada.mic.configurar({ ruido: r, sensibilidade: c.sensibilidadeMic })
    setEtapa('teste')
  }

  const barra = Math.min(100, Math.round(Math.sqrt(nivel) * 300))
  return (
    <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-200" data-testid="calibracao">
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-400/90">
        <Mic size={14} /> Calibração do microfone
      </h2>
      <p className="text-xs text-slate-400">
        Coloque o celular perto dos alto-falantes do CT-S300, num lugar calmo. Use o volume do teclado em nível médio. Funciona melhor com uma nota por vez; acordes pelo microfone são <strong>experimentais</strong>.
      </p>
      {erro && <p className="rounded-xl bg-red-500/15 p-2 text-xs text-red-200">{erro}</p>}
      {status.microfone !== 'ouvindo' ? (
        <button type="button" onClick={() => void ligar()} className="flex h-11 items-center gap-2 rounded-xl bg-rose-500 px-4 font-bold text-white" data-testid="calibrar-ligar">
          <Mic size={16} /> 1. Ativar o microfone
        </button>
      ) : (
        <>
          <div className="h-3 overflow-hidden rounded-full bg-white/10" aria-label="Nível do microfone">
            <div className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500 transition-[width] duration-75" style={{ width: `${barra}%` }} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void medir()} className="h-10 rounded-xl bg-white/10 px-3 font-semibold" data-testid="calibrar-silencio">
              2. Medir o silêncio (2 s)
            </button>
            <button type="button" onClick={() => entrada.desligarMicrofone()} className="h-10 rounded-xl bg-white/5 px-3 text-slate-300">
              Desligar
            </button>
          </div>
          {c.ruidoMic !== null && <p className="text-xs text-slate-400">Ruído medido: {(c.ruidoMic * 1000).toFixed(1)} (portão de ruído ajustado).</p>}
          <div className={`rounded-xl p-3 ${etapa === 'ok' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/5'}`} data-testid="calibrar-teste">
            <p className="font-semibold">3. Toque o Dó central (Dó4) no CT-S300</p>
            <p className="mt-1 text-2xl font-black" data-testid="nota-ouvida">
              {ouvida !== null ? nomeComOitava(ouvida, c.estiloNome) : '—'}
            </p>
            <p className="text-xs">{etapa === 'ok' ? 'Perfeito! O microfone está reconhecendo o seu teclado.' : ouvida !== null && ouvida !== 60 ? 'Essa não é o Dó central. Tente de novo (Dó4 fica no meio, à esquerda das 2 teclas pretas).' : 'Aguardando a nota…'}</p>
          </div>
          <label className="block text-xs">
            Sensibilidade: {c.sensibilidadeMic.toFixed(1)}×
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={c.sensibilidadeMic}
              onChange={(e) => {
                const s = Number(e.target.value)
                mudar({ sensibilidadeMic: s })
                entrada.mic.configurar({ sensibilidade: s })
              }}
              className="w-full accent-amber-400"
            />
          </label>
        </>
      )}
    </div>
  )
}
