import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Info, Play, Repeat, Timer, Trash2, TrendingUp } from 'lucide-react'
import { acharMusica } from '../lib/musica/catalogo'
import { licoesDaMusica, temMaoEsquerda } from '../lib/musica/passos'
import { DESCRICAO_MODO, MODOS, NIVEIS, NOME_MODO, NOME_NIVEL } from '../lib/musica/tipos'
import type { Modo, Nivel } from '../lib/musica/tipos'
import { apagarMusicaImportada, lerHistorico, recomendacaoNivel } from '../lib/treino/armazenamento'
import { useConfig } from '../lib/treino/useConfig'

export default function MusicaDetalhe() {
  const { id = '' } = useParams()
  const [sp] = useSearchParams()
  const navigate = useNavigate()
  const musica = useMemo(() => acharMusica(id), [id])
  const [config] = useConfig()
  const [nivel, setNivel] = useState<Nivel>(NIVEIS.includes(sp.get('nivel') as Nivel) ? (sp.get('nivel') as Nivel) : 'facil')
  const [modo, setModo] = useState<Modo>(MODOS.includes(sp.get('modo') as Modo) ? (sp.get('modo') as Modo) : 'direita')
  const [ritmo, setRitmo] = useState(false)
  const [secao, setSecao] = useState<string>('todas')
  const [loop, setLoop] = useState(false)
  const [vel, setVel] = useState(Math.round(config.velocidadePadrao * 100))

  if (!musica) {
    return (
      <div className="pt-10 text-center text-slate-300">
        Música não encontrada. <Link to="/musicas" className="text-amber-400 underline">Biblioteca</Link>
      </div>
    )
  }
  const hist = lerHistorico().filter((h) => h.musicaId === musica.id)
  const rec = recomendacaoNivel(hist, musica.id, nivel)
  const licoes = licoesDaMusica(musica, nivel)
  const feitas = new Set(hist.filter((h) => h.nivel === nivel && h.licao && h.pontuacao >= 70).map((h) => h.licao))
  const melhorNivel = (nv: Nivel) => Math.max(-1, ...hist.filter((h) => h.nivel === nv).map((h) => h.pontuacao))

  const iniciar = () => {
    const q = new URLSearchParams({ nivel, modo, vel: String(vel / 100) })
    if (ritmo) q.set('ritmo', '1')
    if (secao !== 'todas') q.set('secao', secao)
    if (loop) q.set('loop', '1')
    navigate(`/tocar/${musica.id}?${q.toString()}`)
  }

  return (
    <div className="space-y-5 pt-2" data-testid="musica-detalhe">
      <div className="flex items-start gap-3">
        <Link to="/musicas" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-white" aria-label="Voltar">
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold leading-tight text-white">{musica.titulo}</h1>
          <p className="text-sm text-slate-400">{musica.compositor}</p>
          <p className="text-xs text-slate-500">
            {musica.tonalidade ? `${musica.tonalidade} · ` : ''}compasso {musica.compasso.join('/')} · {musica.bpm} bpm
          </p>
        </div>
      </div>

      {musica.descricao && <p className="text-sm text-slate-300">{musica.descricao}</p>}

      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-amber-400/90">Nível</h2>
        <div className="grid grid-cols-3 gap-2">
          {NIVEIS.map((nv) => {
            const b = melhorNivel(nv)
            return (
              <button
                key={nv}
                type="button"
                onClick={() => setNivel(nv)}
                className={`rounded-2xl border p-2.5 text-left ${nivel === nv ? 'border-amber-400 bg-amber-400/15' : 'border-white/10 bg-white/[0.03]'}`}
                data-testid={`nivel-${nv}`}
                aria-pressed={nivel === nv}
              >
                <p className="text-sm font-bold text-white">{NOME_NIVEL[nv]}</p>
                <p className="text-[10px] leading-tight text-slate-400">{nv === 'facil' ? 'melodia, devagar' : nv === 'intermediario' ? '+ baixo da mão esquerda' : 'duas mãos completas'}</p>
                {b >= 0 && <p className="mt-1 text-[10px] font-semibold text-emerald-300">melhor {b}%</p>}
              </button>
            )
          })}
        </div>
        {musica.observacoes?.[nivel] && (
          <p className="flex gap-1.5 text-xs text-slate-400">
            <Info size={14} className="mt-0.5 shrink-0" /> {musica.observacoes[nivel]}
          </p>
        )}
        {rec && (
          <button type="button" onClick={() => setNivel(rec)} className="flex w-full items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-left text-sm text-emerald-200">
            <TrendingUp size={18} /> Você já passou de 90% duas vezes. Recomendo subir para {NOME_NIVEL[rec]}.
          </button>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-amber-400/90">Aulas passo a passo</h2>
        <div className="space-y-2">
          {licoes.map((l) => (
            <Link
              key={l.id}
              to={`/tocar/${musica.id}?nivel=${nivel}&licao=${l.id}`}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 active:scale-[0.99]"
              data-testid={`licao-${l.id}`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black ${feitas.has(l.id) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>
                {feitas.has(l.id) ? <CheckCircle2 size={18} /> : l.id}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-white">{l.titulo}</span>
                <span className="block text-[11px] text-slate-400">{l.descricao}</span>
              </span>
              <Play size={16} className="text-amber-400" />
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-amber-400/90">Praticar livre</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {MODOS.map((m) => {
            const semEsq = (m === 'esquerda' || m === 'separadas') && !temMaoEsquerda(musica, 'avancado')
            return (
              <button
                key={m}
                type="button"
                disabled={semEsq}
                onClick={() => setModo(m)}
                className={`rounded-2xl border p-2.5 text-left disabled:opacity-40 ${modo === m ? 'border-sky-400 bg-sky-400/15' : 'border-white/10 bg-white/[0.03]'}`}
                data-testid={`modo-${m}`}
                aria-pressed={modo === m}
              >
                <p className="text-sm font-bold text-white">{NOME_MODO[m]}</p>
                <p className="text-[10px] leading-tight text-slate-400">{DESCRICAO_MODO[m]}</p>
              </button>
            )
          })}
        </div>
        {nivel === 'facil' && (modo === 'esquerda' || modo === 'juntas' || modo === 'separadas' || modo === 'desafio') && (
          <p className="text-[11px] text-slate-400">No nível Fácil não há mão esquerda; nestes modos usamos o baixo do nível Intermediário.</p>
        )}

        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
            <span className="flex items-center gap-2">
              <Timer size={16} className="text-amber-400" /> Modo ritmo (metrônomo + contagem)
            </span>
            <input type="checkbox" checked={ritmo} onChange={(e) => setRitmo(e.target.checked)} className="h-5 w-5 accent-amber-400" data-testid="opcao-ritmo" />
          </label>
          {musica.ritmoAproximado && ritmo && <p className="text-[11px] text-amber-300">O ritmo desta cantiga é aproximado.</p>}
          <label className="block text-sm text-slate-200">
            Velocidade: <strong>{vel}%</strong>
            <input type="range" min={40} max={120} step={5} value={vel} onChange={(e) => setVel(Number(e.target.value))} className="mt-1 w-full accent-amber-400" />
          </label>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
            <span>Trecho:</span>
            <select value={secao} onChange={(e) => setSecao(e.target.value)} className="h-9 rounded-lg bg-slate-900 px-2 text-sm text-white" data-testid="opcao-secao">
              <option value="todas">Música inteira</option>
              {musica.secoes.map((s, i) => (
                <option key={i} value={String(i)}>
                  {s.nome}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} className="h-4 w-4 accent-amber-400" />
              <Repeat size={14} /> repetir sem parar
            </label>
          </div>
        </div>
        <button
          type="button"
          onClick={iniciar}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-base font-black text-slate-950 active:scale-[0.98]"
          data-testid="iniciar-pratica"
        >
          <Play size={20} fill="currentColor" /> PRATICAR: {NOME_MODO[modo].toUpperCase()}
        </button>
      </section>

      <section className="space-y-1 text-[11px] leading-relaxed text-slate-500">
        <p>{musica.licenca}</p>
        {musica.fontes?.map((f) => <p key={f}>{f}</p>)}
        {musica.ritmoAproximado && <p>Ritmo aproximado: o professor confere as notas; o modo ritmo é só uma referência.</p>}
        <p>Dedilhado sugerido automaticamente — ajuste se outro dedo for mais confortável.</p>
        {musica.origem === 'importada' && (
          <button
            type="button"
            onClick={() => {
              if (confirm('Apagar esta música importada deste aparelho?')) {
                apagarMusicaImportada(musica.id)
                navigate('/musicas')
              }
            }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-300"
          >
            <Trash2 size={14} /> Apagar música importada
          </button>
        )}
      </section>
    </div>
  )
}
