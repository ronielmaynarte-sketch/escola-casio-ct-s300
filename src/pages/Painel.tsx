import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Clock, Flame, GraduationCap, Hourglass, Piano, Play, Trophy } from 'lucide-react'
import { useProgresso } from '../lib/ProgressContext'
import {
  CURSO,
  MODULOS,
  TOTAL_AULAS,
  formatarDuracao,
  moduloAtual,
  moduloTemConteudo,
  progressoGeral,
  progressoModulo,
  proximaAula,
  statusModulo,
  tempoTotal,
  totalConcluidas,
} from '../lib/curso'
import { calcularSequencia } from '../lib/storage'
import { Barra, Cartao, SeloModulo } from '../components/ui'

export default function Painel() {
  const { dados } = useProgresso()
  const navigate = useNavigate()
  const pct = progressoGeral(dados)
  const prox = proximaAula(dados)
  const atual = moduloAtual(dados)
  const seq = calcularSequencia(dados.diasAtivos)
  const concluidas = totalConcluidas(dados)

  const continuar = () => {
    if (prox) navigate(`/aula/${prox.loc.aula.id}`)
    else navigate(`/modulo/${atual.id}`)
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3 pt-2">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-orange-600/30">
          <Piano size={26} className="text-slate-950" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold leading-tight text-white">{CURSO.nome}</h1>
          <p className="text-sm text-slate-400">Teclado: {CURSO.teclado}</p>
        </div>
      </header>

      <Cartao className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Progresso geral</p>
            <p className="text-5xl font-black tabular-nums text-white">
              {pct}
              <span className="text-2xl text-amber-400">%</span>
            </p>
          </div>
          <p className="pb-2 text-right text-xs text-slate-400">
            {concluidas} de {TOTAL_AULAS}
            <br />
            aulas
          </p>
        </div>
        <Barra valor={pct} className="mt-3" />

        <div className="mt-5 space-y-1 text-sm">
          <p className="text-slate-400">
            Módulo atual: <span className="font-semibold text-white">{atual.numero}. {atual.titulo}</span>
          </p>
          <p className="text-slate-400">
            Próxima aula:{' '}
            <span className="font-semibold text-white">
              {prox ? prox.loc.aula.titulo : 'todas as aulas disponíveis foram concluídas'}
            </span>
            {prox?.status === 'em_preparo' && <span className="ml-1 text-violet-300">(em preparação)</span>}
          </p>
        </div>

        <button
          type="button"
          onClick={continuar}
          className="mt-5 flex h-16 w-full items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-[17px] font-black text-slate-950 shadow-lg shadow-orange-500/30 transition active:scale-[0.98]"
        >
          <Play size={22} fill="currentColor" /> CONTINUAR APRENDENDO
        </button>
      </Cartao>

      <div className="grid grid-cols-3 gap-3">
        <Info Icon={Clock} valor={formatarDuracao(tempoTotal(dados))} rotulo="Tempo de estudo" />
        <Info Icon={GraduationCap} valor={String(concluidas)} rotulo="Aulas concluídas" />
        <Info Icon={Flame} valor={`${seq} ${seq === 1 ? 'dia' : 'dias'}`} rotulo="Sequência" />
      </div>

      <Link to="/progresso" className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-slate-300 active:bg-white/10">
        <span className="flex items-center gap-2">
          <Trophy size={18} className="text-amber-400" /> Conquistas: {Object.keys(dados.conquistas).length}
        </span>
        <ChevronRight size={18} />
      </Link>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-amber-400/90">Módulos do curso</h2>
        <div className="space-y-3">
          {MODULOS.map((m) => {
            const st = statusModulo(m, dados)
            const p = progressoModulo(m, dados)
            const bloqueado = st === 'bloqueado'
            const conteudo = moduloTemConteudo(m)
            return (
              <Link
                key={m.id}
                to={`/modulo/${m.id}`}
                className={`block rounded-3xl border p-4 transition active:scale-[0.99] ${
                  m.id === atual.id && !bloqueado ? 'border-amber-400/40 bg-amber-400/[0.06]' : 'border-white/10 bg-white/[0.03]'
                } ${bloqueado ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg font-black ${
                      st === 'concluido' ? 'bg-emerald-500/20 text-emerald-300' : bloqueado ? 'bg-white/5 text-slate-500' : 'bg-amber-400/15 text-amber-300'
                    }`}
                  >
                    {m.numero}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-white">{m.titulo}</h3>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{m.descricao}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <SeloModulo status={st} />
                      {!conteudo && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-300">
                          <Hourglass size={12} /> Conteúdo em preparação
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500">{m.aulas.length} aulas</span>
                    </div>
                    <Barra valor={p} className="mt-3 h-1.5" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function Info({ Icon, valor, rotulo }: { Icon: typeof Clock; valor: string; rotulo: string }) {
  return (
    <Cartao className="p-3">
      <Icon size={18} className="text-amber-400" />
      <p className="mt-2 text-base font-bold leading-tight text-white">{valor}</p>
      <p className="text-[11px] leading-tight text-slate-400">{rotulo}</p>
    </Cartao>
  )
}
