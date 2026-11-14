import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, Clock, Music2, Target, Trash2 } from 'lucide-react'
import { lerHistorico, limparHistorico } from '../lib/treino/armazenamento'
import type { RegistroTreino } from '../lib/treino/armazenamento'
import { NOME_MODO, NOME_NIVEL } from '../lib/musica/tipos'
import type { Modo } from '../lib/musica/tipos'
import { Cartao } from '../components/ui'

function Grafico({ pontos }: { pontos: RegistroTreino[] }) {
  if (pontos.length < 1) return <p className="text-sm text-slate-500">Toque uma música para ver sua evolução aqui.</p>
  const W = 320
  const H = 120
  const p = pontos.slice(-20)
  const x = (i: number) => (p.length === 1 ? W / 2 : 12 + (i * (W - 24)) / (p.length - 1))
  const y = (v: number) => H - 10 - (v / 100) * (H - 20)
  const linha = p.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.pontuacao).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" role="img" aria-label="Evolução da pontuação" data-testid="grafico-evolucao">
      {[0, 50, 90, 100].map((v) => (
        <g key={v}>
          <line x1={0} x2={W} y1={y(v)} y2={y(v)} stroke={v === 90 ? '#34d39955' : '#ffffff14'} strokeDasharray={v === 90 ? '4 3' : undefined} />
          <text x={2} y={y(v) - 2} fontSize={8} fill="#94a3b8">
            {v}%
          </text>
        </g>
      ))}
      <path d={linha} fill="none" stroke="#f59e0b" strokeWidth={2.5} strokeLinejoin="round" />
      {p.map((r, i) => (
        <circle key={r.id} cx={x(i)} cy={y(r.pontuacao)} r={3.5} fill={r.pontuacao >= 90 ? '#34d399' : r.pontuacao >= 70 ? '#fbbf24' : '#f87171'} />
      ))}
    </svg>
  )
}

export default function MeuProgresso() {
  const [hist, setHist] = useState(() => lerHistorico())
  const [filtro, setFiltro] = useState<string>('todas')
  const musicas = useMemo(() => [...new Map(hist.map((h) => [h.musicaId, h.titulo])).entries()], [hist])
  const sel = filtro === 'todas' ? hist : hist.filter((h) => h.musicaId === filtro)
  const media = sel.length ? Math.round(sel.reduce((s, h) => s + h.pontuacao, 0) / sel.length) : 0
  const tempo = Math.round(sel.reduce((s, h) => s + h.tempoMs, 0) / 60000)
  const melhores = musicas.map(([id, titulo]) => {
    const hs = hist.filter((h) => h.musicaId === id)
    return { id, titulo, melhor: Math.max(...hs.map((h) => h.pontuacao)), vezes: hs.length, ultimo: hs[hs.length - 1] }
  })

  return (
    <div className="space-y-6 pt-2" data-testid="meu-progresso">
      <header>
        <h1 className="text-2xl font-extrabold text-white">Meu progresso nas músicas</h1>
        <p className="text-sm text-slate-400">Cada avaliação fica salva neste aparelho.</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Cartao className="p-3">
          <Music2 size={18} className="text-amber-400" />
          <p className="mt-2 text-base font-bold text-white" data-testid="total-sessoes">{sel.length}</p>
          <p className="text-[11px] text-slate-400">avaliações</p>
        </Cartao>
        <Cartao className="p-3">
          <Target size={18} className="text-amber-400" />
          <p className="mt-2 text-base font-bold text-white">{media}%</p>
          <p className="text-[11px] text-slate-400">média</p>
        </Cartao>
        <Cartao className="p-3">
          <Clock size={18} className="text-amber-400" />
          <p className="mt-2 text-base font-bold text-white">{tempo} min</p>
          <p className="text-[11px] text-slate-400">tocando</p>
        </Cartao>
      </div>

      <Cartao className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-400/90">
            <BarChart3 size={14} /> Evolução
          </h2>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)} className="h-8 max-w-[55%] rounded-lg bg-slate-900 px-2 text-xs text-white">
            <option value="todas">Todas as músicas</option>
            {musicas.map(([id, t]) => (
              <option key={id} value={id}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <Grafico pontos={sel} />
        <p className="text-[10px] text-slate-500">Linha tracejada: 90% (duas vezes acima dela = hora de subir de nível).</p>
      </Cartao>

      {melhores.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-amber-400/90">Por música</h2>
          {melhores.map((m) => (
            <Link key={m.id} to={`/musica/${m.id}`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-bold text-white">{m.titulo}</span>
                <span className="block text-[11px] text-slate-400">
                  {m.vezes}× · último: {NOME_NIVEL[m.ultimo.nivel]}, {m.ultimo.modo === 'licao' ? `lição ${m.ultimo.licao}` : NOME_MODO[m.ultimo.modo as Modo]}
                </span>
              </span>
              <span className={`text-lg font-black ${m.melhor >= 90 ? 'text-emerald-300' : 'text-amber-300'}`}>{m.melhor}%</span>
            </Link>
          ))}
        </section>
      )}

      {sel.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-amber-400/90">Histórico</h2>
          <ul className="space-y-2" data-testid="historico-treino">
            {[...sel].reverse().slice(0, 40).map((h) => (
              <li key={h.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{h.titulo}</span>
                  <span className="font-black text-amber-300">{h.pontuacao}%</span>
                </div>
                <p className="text-slate-400">
                  {new Date(h.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {NOME_NIVEL[h.nivel]} · {h.modo === 'licao' ? `lição ${h.licao}` : NOME_MODO[h.modo as Modo]} · ✓{h.corretas} ✗{h.erradas}
                  {h.ritmo !== null ? ` · ritmo ${h.ritmo}%` : ''} · {h.fonte}
                </p>
                {h.pontosAMelhorar[0] && <p className="mt-1 text-slate-500">{h.pontosAMelhorar[0]}</p>}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              if (confirm('Apagar todo o histórico das músicas?')) {
                limparHistorico()
                setHist([])
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-300"
          >
            <Trash2 size={14} /> Apagar histórico
          </button>
        </section>
      )}
    </div>
  )
}
