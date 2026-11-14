import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Gauge,
  Headphones,
  Mic,
  MicOff,
  Play,
  RotateCcw,
  Square,
  Target,
  Timer,
  TrendingUp,
  Usb,
  XCircle,
  CheckCircle2,
} from 'lucide-react'
import TecladoProfessor from '../components/TecladoProfessor'
import FaixaNotas from '../components/FaixaNotas'
import SeloEntrada from '../components/SeloEntrada'
import { acharMusica } from '../lib/musica/catalogo'
import { MotorTocar } from '../lib/musica/motor'
import type { Resultado, Retorno } from '../lib/musica/motor'
import { licoesDaMusica, planoDoModo } from '../lib/musica/passos'
import { NOME_MODO, NOME_NIVEL } from '../lib/musica/tipos'
import type { Modo, MusicaDef, Nivel } from '../lib/musica/tipos'
import { entrada, useStatusEntrada } from '../lib/input/hub'
import { webMidiSuportado } from '../lib/input/webmidi'
import { soltarNota, tocarClique, tocarNota } from '../lib/audio'
import { nome, nomeComOitava } from '../lib/musica/notas'
import { adicionarHistorico, lerHistorico, recomendacaoNivel } from '../lib/treino/armazenamento'
import { useConfig } from '../lib/treino/useConfig'
import { useProgresso } from '../lib/ProgressContext'
import { novoId } from '../lib/storage'

type Fase = 'pronto' | 'contagem' | 'tocando' | 'pausa' | 'fim'

interface Mensagem {
  tipo: 'erro' | 'ok' | 'info' | 'aviso'
  texto: string
}

const NIVEIS_OK: Nivel[] = ['facil', 'intermediario', 'avancado']
const MODOS_OK: Modo[] = ['direita', 'esquerda', 'separadas', 'juntas', 'facil', 'desafio']

function useAlturaTeclado(): { altura: number; paisagem: boolean } {
  const calc = () => {
    const h = window.innerHeight
    const w = window.innerWidth
    const paisagem = w > h && h < 560
    const altura = paisagem ? Math.max(88, Math.min(170, h - 212)) : Math.max(120, Math.min(200, h * 0.3))
    return { altura, paisagem }
  }
  const [v, setV] = useState(calc)
  useEffect(() => {
    const f = () => setV(calc())
    window.addEventListener('resize', f)
    window.addEventListener('orientationchange', f)
    return () => {
      window.removeEventListener('resize', f)
      window.removeEventListener('orientationchange', f)
    }
  }, [])
  return v
}

export default function Tocar() {
  const { id = '' } = useParams()
  const [sp] = useSearchParams()
  const musica = useMemo(() => acharMusica(id), [id])
  if (!musica) {
    return (
      <div className="p-6 text-center text-slate-300">
        Música não encontrada.{' '}
        <Link to="/musicas" className="text-amber-400 underline">
          Voltar à biblioteca
        </Link>
      </div>
    )
  }
  return <TocarMusica key={sp.toString()} musica={musica} />
}

function TocarMusica({ musica }: { musica: MusicaDef }) {
  const [sp] = useSearchParams()
  const navigate = useNavigate()
  const [config] = useConfig()
  const { registrarAtividade } = useProgresso()
  const status = useStatusEntrada()
  const { altura, paisagem } = useAlturaTeclado()

  const nivel: Nivel = NIVEIS_OK.includes(sp.get('nivel') as Nivel) ? (sp.get('nivel') as Nivel) : 'facil'
  const licaoId = sp.get('licao')
  const modo: Modo = MODOS_OK.includes(sp.get('modo') as Modo) ? (sp.get('modo') as Modo) : 'direita'
  const ritmo = sp.get('ritmo') === '1'
  const loop = sp.get('loop') === '1'
  const secParam = sp.get('secao')
  const secoes: [number, number] | undefined = secParam
    ? (() => {
        const p = secParam.split('-').map(Number)
        return [p[0], p[1] ?? p[0]] as [number, number]
      })()
    : undefined

  const plano = useMemo(() => {
    if (licaoId) {
      const l = licoesDaMusica(musica, nivel).find((x) => x.id === licaoId)
      if (l) return l.plano
    }
    return planoDoModo(musica, nivel, modo, secoes)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musica, nivel, modo, licaoId, secParam])

  const velInicial = Number(sp.get('vel')) || plano.velocidadeSugerida || config.velocidadePadrao
  const [velocidade, setVelocidade] = useState(Math.min(1.2, Math.max(0.4, velInicial)))
  const [divisao, setDivisao] = useState(musica.divisao ?? config.divisao)

  const criarMotor = useCallback(
    () =>
      new MotorTocar(musica, plano, {
        ritmo,
        velocidade,
        loop,
        divisao,
        janelaAcordeMs: config.janelaAcordeMs,
        estiloNome: config.estiloNome,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [musica, plano, ritmo, loop],
  )
  const motorRef = useRef<MotorTocar>(criarMotor())
  const motor = motorRef.current
  const [, setTick] = useState(0)
  const atualizar = () => setTick((t) => t + 1)

  const [fase, setFase] = useState<Fase>('pronto')
  const [contagem, setContagem] = useState(0)
  const [msg, setMsg] = useState<Mensagem | null>(null)
  const [pressionadas, setPressionadas] = useState<Set<number>>(new Set())
  const [erradas, setErradas] = useState<Set<number>>(new Set())
  const [acertos, setAcertos] = useState<Set<number>>(new Set())
  const [demo, setDemo] = useState(false)
  const [metronomo, setMetronomo] = useState(ritmo)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const timers = useRef<number[]>([])
  const metroTimer = useRef<number | null>(null)
  const faseRef = useRef<Fase>('pronto')
  faseRef.current = fase

  // mudanças de velocidade/divisão valem na hora
  motor.op.velocidade = velocidade
  motor.op.divisao = divisao

  const regiao = useMemo<[number, number]>(() => {
    const ns = musica.niveis[nivel].concat(musica.niveis.avancado).map((n) => n.midi)
    return [Math.min(...ns), Math.max(...ns)]
  }, [musica, nivel])

  const limparTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  const pararMetronomo = () => {
    if (metroTimer.current !== null) window.clearTimeout(metroTimer.current)
    metroTimer.current = null
  }

  // metrônomo com correção de deriva
  const iniciarMetronomo = useCallback(
    (inicio: number, batida0 = 0) => {
      pararMetronomo()
      const bpc = musica.compasso[0]
      let n = batida0
      const tick = () => {
        const mpb = 60000 / (musica.bpm * motorRef.current.op.velocidade)
        const alvo = inicio + n * mpb
        const agora = performance.now()
        if (agora >= alvo - 5) {
          tocarClique(n % bpc === 0, config.volumeMetronomo)
          n++
        }
        metroTimer.current = window.setTimeout(tick, Math.max(5, inicio + n * mpb - performance.now()))
      }
      tick()
    },
    [musica, config.volumeMetronomo],
  )

  /** contagem de 1 compasso e depois começa (modo ritmo) */
  const contarEComecar = useCallback(
    (primeira: boolean) => {
      const bpc = musica.compasso[0]
      const mpb = motorRef.current.msPorBatida
      const t0 = performance.now() + 200
      setFase('contagem')
      for (let i = 0; i < bpc; i++) {
        timers.current.push(
          window.setTimeout(() => {
            setContagem(bpc - i)
            tocarClique(i === 0, config.volumeMetronomo)
          }, t0 + i * mpb - performance.now()),
        )
      }
      const inicio = t0 + bpc * mpb
      timers.current.push(
        window.setTimeout(() => {
          setContagem(0)
          setFase('tocando')
          if (primeira) motorRef.current.iniciar(inicio)
          else motorRef.current.recomecarRitmo(inicio)
          if (metronomo) iniciarMetronomo(inicio, 0)
          atualizar()
        }, inicio - performance.now()),
      )
    },
    [musica, config.volumeMetronomo, metronomo, iniciarMetronomo],
  )

  const comecar = async () => {
    // o toque do aluno libera o áudio (iOS) e, se for o caso, o microfone
    tocarClique(false, 0.001)
    if (config.fonte === 'microfone' && status.microfone !== 'ouvindo') {
      try {
        await entrada.ligarMicrofone()
      } catch {
        setMsg({ tipo: 'aviso', texto: 'Não foi possível usar o microfone. Você pode tocar na tela ou ligar um teclado MIDI.' })
      }
    }
    setMsg(null)
    if (ritmo) contarEComecar(true)
    else {
      motor.iniciar(performance.now())
      setFase('tocando')
      if (metronomo) iniciarMetronomo(performance.now())
      atualizar()
    }
  }

  // MIDI automático quando suportado (Android/computador)
  useEffect(() => {
    if ((config.fonte === 'auto' || config.fonte === 'midi') && webMidiSuportado() && status.midi === 'desligado') void entrada.ligarMidi()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // informa ao microfone quais notas são esperadas (verificação de acorde / oitava)
  const passo = motor.passoAtual
  const chavePasso = `${motor.indiceTrecho}:${motor.indicePasso}`
  useEffect(() => {
    entrada.setEsperadas(fase === 'tocando' && passo ? passo.notas.map((n) => n.midi) : [])
  }, [chavePasso, fase, passo])

  const flash = (set: (f: (s: Set<number>) => Set<number>) => void, midis: number[], ms: number) => {
    set((s) => new Set([...s, ...midis]))
    timers.current.push(
      window.setTimeout(
        () =>
          set((s) => {
            const n = new Set(s)
            midis.forEach((m) => n.delete(m))
            return n
          }),
        ms,
      ),
    )
  }

  const terminar = useCallback(() => {
    pararMetronomo()
    const r = motorRef.current.resultado(performance.now())
    setResultado(r)
    setFase('fim')
  }, [])

  const tratar = useCallback(
    (r: Retorno, midi: number) => {
      const m = motorRef.current
      switch (r.tipo) {
        case 'erro':
          flash(setErradas, [midi], 800)
          // no Desafio não entregamos a resposta: só avisamos o erro
          setMsg({ tipo: 'erro', texto: plano.ocultarDicas ? `Errou: você tocou ${nome(midi, config.estiloNome)}. Tente outra nota.` : r.mensagem ?? 'Nota errada.' })
          break
        case 'parcial':
          setMsg({ tipo: 'info', texto: r.mensagem ?? '' })
          break
        case 'acorde_separado':
          setMsg({ tipo: 'aviso', texto: r.mensagem ?? '' })
          break
        case 'ignorada':
          if (r.mensagem) setMsg({ tipo: 'info', texto: r.mensagem })
          break
        case 'acerto':
        case 'fim_trecho':
        case 'fim': {
          const ant = m.passosDoTrecho[m.indicePasso - 1]?.notas.map((n) => n.midi) ?? [midi]
          flash(setAcertos, ant.length ? ant : [midi], 260)
          const jtxt = r.julgamento ? { perfeito: 'Perfeito!', bom: 'Bom!', adiantado: 'Certo, mas adiantado', atrasado: 'Certo, mas atrasado' }[r.julgamento] : null
          if (r.tipo === 'acerto') setMsg(jtxt ? { tipo: r.julgamento === 'perfeito' || r.julgamento === 'bom' ? 'ok' : 'aviso', texto: jtxt } : { tipo: 'ok', texto: 'Certo!' })
          if (r.tipo === 'fim_trecho') {
            setMsg({ tipo: 'ok', texto: r.repeticao ?? `Muito bem! Agora: ${m.trechoAtual?.rotulo ?? ''}` })
            if (ritmo) {
              pararMetronomo()
              setFase('pausa')
              timers.current.push(window.setTimeout(() => contarEComecar(false), 1400))
            }
          }
          if (r.tipo === 'fim') terminar()
          break
        }
      }
      atualizar()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ritmo, contarEComecar, terminar, plano.ocultarDicas, config.estiloNome],
  )

  // eventos de todas as fontes (microfone, MIDI, toque)
  useEffect(() => {
    return entrada.ouvir((e) => {
      if (e.tipo === 'on') {
        setPressionadas((s) => new Set(s).add(e.midi))
        if (faseRef.current === 'tocando') tratar(motorRef.current.noteOn(e.midi, e.t), e.midi)
        else if (faseRef.current === 'pronto') setMsg({ tipo: 'info', texto: `Ouvi ${nomeComOitava(e.midi, config.estiloNome)}. Toque em COMEÇAR quando estiver pronto.` })
      } else {
        setPressionadas((s) => {
          const n = new Set(s)
          n.delete(e.midi)
          return n
        })
        motorRef.current.noteOff(e.midi)
      }
    })
  }, [tratar, config.estiloNome])

  useEffect(
    () => () => {
      limparTimers()
      pararMetronomo()
      entrada.setEsperadas([])
    },
    [],
  )

  // demonstração: o app toca os próximos passos (o microfone pausa sozinho enquanto isso)
  const ouvir = () => {
    if (demo) {
      limparTimers()
      setDemo(false)
      return
    }
    const passos = [passo, ...motor.proximos(7)].filter(Boolean) as NonNullable<typeof passo>[]
    if (!passos.length) return
    setDemo(true)
    const mpb = motor.msPorBatida
    let t = 0
    for (const p of passos) {
      const dur = Math.max(0.25, p.dur) * mpb
      timers.current.push(window.setTimeout(() => p.notas.forEach((n) => tocarNota(n.midi, 0.8)), t))
      timers.current.push(window.setTimeout(() => p.notas.forEach((n) => soltarNota(n.midi)), t + dur * 0.9))
      t += dur
    }
    timers.current.push(window.setTimeout(() => setDemo(false), t + 100))
  }

  const reiniciarTudo = () => {
    limparTimers()
    pararMetronomo()
    motorRef.current = criarMotor()
    setResultado(null)
    setMsg(null)
    setFase('pronto')
    atualizar()
  }

  const repetir = () => {
    motor.repetirTrecho()
    setMsg({ tipo: 'info', texto: 'Recomeçando o trecho.' })
    if (ritmo && fase === 'tocando') {
      pararMetronomo()
      contarEComecar(false)
    }
    atualizar()
  }

  const pararEAvaliar = () => {
    limparTimers()
    motor.encerrar(performance.now())
    terminar()
  }

  if (fase === 'fim' && resultado) {
    return (
      <Avaliacao
        musica={musica}
        nivel={nivel}
        modo={licaoId ? 'licao' : modo}
        licao={licaoId ?? undefined}
        titulo={plano.titulo}
        r={resultado}
        fonte={status.ultimaFonte ?? 'toque'}
        onRepetir={reiniciarTudo}
        onSalvo={(pct) => registrarAtividade('musica', `Tocou: ${musica.titulo} — ${plano.titulo} (${pct}%)`)}
        onVoltar={() => navigate(`/musica/${musica.id}`)}
      />
    )
  }

  const trecho = motor.trechoAtual
  const corMsg = msg?.tipo === 'erro' ? 'bg-red-500/20 text-red-100 border-red-500/40' : msg?.tipo === 'ok' ? 'bg-emerald-500/15 text-emerald-100 border-emerald-500/30' : msg?.tipo === 'aviso' ? 'bg-amber-500/15 text-amber-100 border-amber-500/30' : 'bg-white/5 text-slate-200 border-white/10'

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-1.5 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-[max(env(safe-area-inset-top),0.4rem)]" data-testid="tela-tocar" data-fase={fase}>
      {/* topo (em paisagem: uma linha só com as fontes de entrada) */}
      <div className={paisagem ? 'flex items-center gap-2' : 'flex flex-col gap-1.5'}>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Link to={`/musica/${musica.id}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-white" aria-label="Voltar">
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight text-white">{musica.titulo}</p>
          <p className="truncate text-[11px] leading-tight text-slate-400" data-testid="rotulo-trecho">
            {NOME_NIVEL[nivel]} · {plano.titulo} · {trecho?.rotulo ?? ''}
            {motor.tentativa > 1 ? ` · tentativa ${motor.tentativa}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-[11px] tabular-nums">
          <span className="rounded-lg bg-emerald-500/15 px-1.5 py-1 font-bold text-emerald-300" data-testid="contador-acertos">
            ✓ {motor.corretas}
          </span>
          <span className="rounded-lg bg-red-500/15 px-1.5 py-1 font-bold text-red-300" data-testid="contador-erros">
            ✗ {motor.erros.length}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-1">
        <SeloEntrada compacto={paisagem} />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => (status.microfone === 'ouvindo' ? entrada.desligarMicrofone() : void entrada.ligarMicrofone().catch(() => setMsg({ tipo: 'aviso', texto: mensagemMic(entrada.mic.estado) })))}
            className={`flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold ${status.microfone === 'ouvindo' ? 'bg-rose-500/25 text-rose-100' : 'bg-white/10 text-slate-200'}`}
            data-testid="botao-microfone"
            aria-label={status.microfone === 'ouvindo' ? 'Desligar microfone' : 'Ligar microfone'}
          >
            {status.microfone === 'ouvindo' ? <MicOff size={13} /> : <Mic size={13} />} {status.microfone === 'ouvindo' ? 'Desligar mic' : 'Microfone'}
          </button>
          <button
            type="button"
            onClick={() => (webMidiSuportado() ? void entrada.ligarMidi() : setMsg({ tipo: 'aviso', texto: 'Web MIDI não suportado neste navegador (o Safari do iPhone não tem). Use o microfone ou a tela.' }))}
            className={`flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold ${status.midi === 'conectado' ? 'bg-violet-500/25 text-violet-100' : 'bg-white/10 text-slate-200'}`}
            data-testid="botao-midi"
          >
            <Usb size={13} /> {webMidiSuportado() ? 'MIDI' : 'MIDI: não suportado'}
          </button>
        </div>
      </div>

      </div>

      {/* barra de progresso */}
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-[width]" style={{ width: `${Math.round(motor.progresso * 100)}%` }} />
      </div>

      {/* próximas notas + mensagem */}
      <div className={`flex items-center gap-2 ${paisagem ? '' : 'flex-col items-stretch'}`}>
        <div className="min-w-0 flex-1">
          <FaixaNotas atual={passo} proximos={motor.proximos(paisagem ? 7 : 5)} ocultarDicas={plano.ocultarDicas} estiloNome={config.estiloNome} pressionadasCertas={motor.notasJaPressionadas} />
        </div>
        <div className={`min-h-[30px] rounded-xl border px-2.5 py-1.5 text-[13px] font-semibold leading-snug ${corMsg} ${paisagem ? 'w-[44%]' : ''}`} data-testid="mensagem" data-tipo={msg?.tipo ?? ''} aria-live="assertive">
          {fase === 'contagem' ? `Prepare-se… ${contagem}` : fase === 'pausa' ? msg?.texto : msg?.texto ?? (fase === 'pronto' ? 'Veja as próximas notas acima. Toque em COMEÇAR.' : 'Toque as teclas acesas.')}
        </div>
      </div>

      {/* controles */}
      <div className={`flex flex-wrap items-center gap-1.5 ${paisagem ? 'controles-compactos' : ''}`}>
        {fase === 'pronto' ? (
          <button type="button" onClick={() => void comecar()} className="flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 text-sm font-black text-slate-950 active:scale-95" data-testid="botao-comecar">
            <Play size={16} fill="currentColor" /> COMEÇAR
          </button>
        ) : (
          <button type="button" onClick={pararEAvaliar} className="flex h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-sm font-bold text-white active:scale-95" data-testid="botao-avaliar">
            <Flag size={15} /> Parar e avaliar
          </button>
        )}
        <button type="button" onClick={ouvir} className={`flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold active:scale-95 ${demo ? 'bg-sky-500 text-white' : 'bg-white/10 text-white'}`}>
          {demo ? <Square size={14} /> : <Headphones size={15} />} Ouvir
        </button>
        <button type="button" onClick={repetir} className="flex h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-sm font-bold text-white active:scale-95" data-testid="botao-repetir">
          <RotateCcw size={15} /> Repetir
        </button>
        <button
          type="button"
          onClick={() => {
            const novo = !metronomo
            setMetronomo(novo)
            if (!novo) pararMetronomo()
            else if (fase === 'tocando') iniciarMetronomo(performance.now())
          }}
          className={`flex h-10 items-center gap-1 rounded-xl px-3 text-sm font-bold active:scale-95 ${metronomo ? 'bg-amber-400/90 text-slate-950' : 'bg-white/10 text-white'}`}
          aria-pressed={metronomo}
        >
          <Timer size={15} /> Metrônomo
        </button>
        <label className="flex h-10 items-center gap-1.5 rounded-xl bg-white/5 px-2 text-xs text-slate-300">
          <Gauge size={14} />
          <input type="range" min={40} max={120} step={5} value={Math.round(velocidade * 100)} onChange={(e) => setVelocidade(Number(e.target.value) / 100)} className="w-20 accent-amber-400" aria-label="Velocidade" data-testid="velocidade" />
          <span className="w-9 tabular-nums">{Math.round(velocidade * 100)}%</span>
        </label>
        <div className="flex h-10 items-center gap-0.5 rounded-xl bg-white/5 px-1 text-[11px] text-slate-300">
          <button type="button" onClick={() => setDivisao((d) => Math.max(40, d - 1))} className="grid h-8 w-7 place-items-center" aria-label="Mover divisão para a esquerda">
            <ChevronLeft size={15} />
          </button>
          <span className="whitespace-nowrap">divisão {nomeComOitava(divisao, config.estiloNome)}</span>
          <button type="button" onClick={() => setDivisao((d) => Math.min(84, d + 1))} className="grid h-8 w-7 place-items-center" aria-label="Mover divisão para a direita">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {musica.ritmoAproximado && ritmo && <p className="text-[11px] text-amber-300">Atenção: nesta cantiga o ritmo é aproximado; confie mais nas notas.</p>}
      {plano.trechos.some((t) => t.maos !== 'direita') && status.microfone === 'ouvindo' && passo && passo.notas.length > 1 && (
        <p className="text-[11px] text-amber-300" data-testid="aviso-acorde-mic">
          Acordes pelo microfone: reconhecimento EXPERIMENTAL. Se falhar, toque as notas bem juntas e firmes, ou use MIDI/tela.
        </p>
      )}

      {/* teclado */}
      <div className="mt-auto">
        <TecladoProfessor
          esperadas={fase === 'tocando' || fase === 'pronto' ? passo?.notas : []}
          seguintes={motor.proximos(1)[0]?.notas}
          pressionadas={pressionadas}
          erradas={erradas}
          acertos={acertos}
          divisao={divisao}
          ocultarDicas={plano.ocultarDicas}
          estiloNome={config.estiloNome}
          som={config.somDoTeclado && status.microfone !== 'ouvindo'}
          onNote={(m, on) => entrada.toque(m, on)}
          altura={altura}
          regiao={regiao}
          legenda={!paisagem}
        />
      </div>
    </div>
  )
}

export function mensagemMic(estado: string): string {
  switch (estado) {
    case 'negado':
      return 'O microfone foi bloqueado. No iPhone: Ajustes › Safari › Microfone › Permitir (ou toque em "aA" na barra de endereço › Ajustes do site).'
    case 'sem-microfone':
      return 'Nenhum microfone encontrado neste aparelho.'
    case 'inseguro':
      return 'O microfone só funciona em endereço seguro (https).'
    default:
      return 'Não foi possível ligar o microfone neste navegador.'
  }
}

function formatarTempo(ms: number): string {
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  return m ? `${m} min ${s % 60} s` : `${s} s`
}

function Avaliacao({
  musica,
  nivel,
  modo,
  licao,
  titulo,
  r,
  fonte,
  onRepetir,
  onSalvo,
  onVoltar,
}: {
  musica: MusicaDef
  nivel: Nivel
  modo: Modo | 'licao'
  licao?: string
  titulo: string
  r: Resultado
  fonte: string
  onRepetir: () => void
  onSalvo: (pct: number) => void
  onVoltar: () => void
}) {
  const salvo = useRef(false)
  const [recomendado, setRecomendado] = useState<Nivel | null>(null)
  useEffect(() => {
    if (salvo.current) return
    salvo.current = true
    if (r.corretas + r.erradas === 0) return
    adicionarHistorico({
      id: novoId(),
      em: new Date().toISOString(),
      musicaId: musica.id,
      titulo: musica.titulo,
      nivel,
      modo,
      licao,
      corretas: r.corretas,
      erradas: r.erradas,
      ritmo: r.ritmo?.precisao ?? null,
      tempoMs: r.tempoMs,
      pontuacao: r.pontuacao,
      precisaoNotas: r.precisaoNotas,
      pontosAMelhorar: r.pontosAMelhorar,
      fonte,
    })
    onSalvo(r.pontuacao)
    setRecomendado(recomendacaoNivel(lerHistorico(), musica.id, nivel))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const licaoNum = licao ? Number(licao.slice(1)) : null
  const navigate = useNavigate()
  const cor = r.pontuacao >= 90 ? 'text-emerald-300' : r.pontuacao >= 70 ? 'text-amber-300' : 'text-red-300'
  return (
    <div className="mx-auto min-h-dvh max-w-xl space-y-4 px-4 pb-10 pt-[max(env(safe-area-inset-top),1rem)]" data-testid="avaliacao">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-400/90">Avaliação</p>
        <h1 className="text-xl font-extrabold text-white">{musica.titulo}</h1>
        <p className="text-sm text-slate-400">
          {NOME_NIVEL[nivel]} · {modo === 'licao' ? titulo : NOME_MODO[modo]}
        </p>
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-center">
        <p className={`text-6xl font-black tabular-nums ${cor}`} data-testid="pontuacao">
          {r.pontuacao}
          <span className="text-2xl">%</span>
        </p>
        <p className="mt-1 text-sm text-slate-400">{r.pontuacao >= 90 ? 'Excelente!' : r.pontuacao >= 70 ? 'Bom trabalho, continue praticando.' : 'Vamos devagar: diminua a velocidade e repita.'}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Num Icon={CheckCircle2} cor="text-emerald-300" v={String(r.corretas)} rot="notas certas" teste="res-certas" />
        <Num Icon={XCircle} cor="text-red-300" v={String(r.erradas)} rot="notas erradas" teste="res-erradas" />
        <Num Icon={Target} cor="text-sky-300" v={r.ritmo ? `${r.ritmo.precisao}%` : '—'} rot={r.ritmo ? 'precisão do ritmo' : 'ritmo (desligado)'} teste="res-ritmo" />
        <Num Icon={Clock} cor="text-amber-300" v={formatarTempo(r.tempoMs)} rot="tempo" teste="res-tempo" />
      </div>
      {r.ritmo && (
        <p className="text-center text-xs text-slate-400">
          Perfeito {r.ritmo.perfeito} · Bom {r.ritmo.bom} · Adiantado {r.ritmo.adiantado} · Atrasado {r.ritmo.atrasado}
        </p>
      )}
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-400/90">Pontos a melhorar</h2>
        <ul className="space-y-1.5 text-sm text-slate-200" data-testid="pontos-melhorar">
          {r.pontosAMelhorar.map((p) => (
            <li key={p} className="flex gap-2">
              <span className="text-amber-400">•</span> {p}
            </li>
          ))}
        </ul>
        {r.trechosRepetidos > 0 && <p className="mt-2 text-xs text-slate-400">Trechos repetidos para reforço: {r.trechosRepetidos}.</p>}
      </section>
      {recomendado && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-200" data-testid="recomendacao">
          <TrendingUp size={18} /> Você passou de 90% duas vezes neste nível. Hora de tentar o nível {NOME_NIVEL[recomendado]}!
        </div>
      )}
      <div className="grid gap-2">
        <button type="button" onClick={onRepetir} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/10 font-bold text-white active:scale-[0.98]" data-testid="avaliacao-repetir">
          <RotateCcw size={18} /> Tocar de novo
        </button>
        {licaoNum !== null && licaoNum < 6 && (
          <button
            type="button"
            onClick={() => navigate(`/tocar/${musica.id}?nivel=${nivel}&licao=L${licaoNum + 1}`)}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 font-black text-slate-950 active:scale-[0.98]"
          >
            <Play size={18} fill="currentColor" /> Próxima lição (L{licaoNum + 1})
          </button>
        )}
        {recomendado && (
          <button type="button" onClick={() => navigate(`/musica/${musica.id}?nivel=${recomendado}`)} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-500/20 font-bold text-emerald-200 active:scale-[0.98]">
            <TrendingUp size={18} /> Ir para {NOME_NIVEL[recomendado]}
          </button>
        )}
        <button type="button" onClick={onVoltar} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/5 font-semibold text-slate-200 active:scale-[0.98]">
          Voltar à música
        </button>
      </div>
    </div>
  )
}

function Num({ Icon, cor, v, rot, teste }: { Icon: typeof Clock; cor: string; v: string; rot: string; teste: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <Icon size={18} className={cor} />
      <p className="mt-1 text-lg font-bold leading-tight text-white" data-testid={teste}>
        {v}
      </p>
      <p className="text-[11px] leading-tight text-slate-400">{rot}</p>
    </div>
  )
}
