import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Lock } from 'lucide-react'
import { useProgresso } from '../lib/ProgressContext'
import { MODULOS, acharModulo, progressoModulo, statusAula, statusModulo } from '../lib/curso'
import { Barra, SeloAula, SeloModulo } from '../components/ui'

export default function ModuloPagina() {
  const { id = '' } = useParams()
  const { dados } = useProgresso()
  const m = acharModulo(id)

  if (!m) {
    return (
      <div className="space-y-4 pt-6">
        <p className="text-slate-300">Módulo não encontrado.</p>
        <Link to="/" className="text-amber-400">
          Voltar ao painel
        </Link>
      </div>
    )
  }

  const st = statusModulo(m, dados)
  const anterior = MODULOS[m.numero - 2]

  return (
    <div className="space-y-5">
      <Link to="/" className="inline-flex h-11 items-center gap-2 text-sm text-slate-400 active:text-white">
        <ArrowLeft size={18} /> Painel
      </Link>
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-400">Módulo {m.numero}</p>
        <h1 className="mt-1 text-2xl font-extrabold text-white">{m.titulo}</h1>
        <p className="mt-1 text-sm text-slate-400">{m.descricao}</p>
        <div className="mt-3 flex items-center gap-3">
          <SeloModulo status={st} />
          <span className="text-xs text-slate-400">{progressoModulo(m, dados)}% concluído</span>
        </div>
        <Barra valor={progressoModulo(m, dados)} className="mt-3" />
      </header>

      {st === 'bloqueado' && anterior && (
        <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
          <Lock size={20} className="shrink-0 text-slate-500" />
          Conclua o Módulo {anterior.numero} ({anterior.titulo}) para desbloquear este módulo.
        </div>
      )}

      <ol className="space-y-2">
        {m.aulas.map((a, i) => {
          const s = statusAula(a.id, dados)
          const clicavel = s === 'concluida' || s === 'disponivel'
          const conteudo = (
            <div
              className={`flex items-center gap-3 rounded-2xl border p-3.5 transition ${
                s === 'disponivel' ? 'border-amber-400/40 bg-amber-400/[0.06]' : 'border-white/10 bg-white/[0.03]'
              } ${clicavel ? 'active:scale-[0.99]' : 'opacity-70'}`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5 text-sm font-bold text-slate-300">{i + 1}</span>
              <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-white">{a.titulo}</span>
              <SeloAula status={s} />
            </div>
          )
          return (
            <li key={a.id}>
              {clicavel ? <Link to={`/aula/${a.id}`}>{conteudo}</Link> : conteudo}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
