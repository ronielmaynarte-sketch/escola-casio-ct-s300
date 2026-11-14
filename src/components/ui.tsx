import type { ReactNode } from 'react'
import { CheckCircle2, CircleDot, Lock, PlayCircle, Hourglass } from 'lucide-react'
import type { StatusAula, StatusModulo } from '../lib/types'

export function Barra({ valor, className = '' }: { valor: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-white/10 ${className}`} role="progressbar" aria-valuenow={valor} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-[width] duration-700" style={{ width: `${valor}%` }} />
    </div>
  )
}

const MOD: Record<StatusModulo, { txt: string; cls: string; Icon: typeof Lock }> = {
  disponivel: { txt: 'Disponível', cls: 'bg-sky-500/15 text-sky-300', Icon: PlayCircle },
  andamento: { txt: 'Em andamento', cls: 'bg-amber-400/15 text-amber-300', Icon: CircleDot },
  concluido: { txt: 'Concluído', cls: 'bg-emerald-500/15 text-emerald-300', Icon: CheckCircle2 },
  bloqueado: { txt: 'Bloqueado', cls: 'bg-white/5 text-slate-500', Icon: Lock },
}

export function SeloModulo({ status }: { status: StatusModulo }) {
  const { txt, cls, Icon } = MOD[status]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      <Icon size={12} /> {txt}
    </span>
  )
}

const AULA: Record<StatusAula, { txt: string; cls: string; Icon: typeof Lock }> = {
  concluida: { txt: 'Concluída', cls: 'bg-emerald-500/15 text-emerald-300', Icon: CheckCircle2 },
  disponivel: { txt: 'Disponível', cls: 'bg-amber-400/15 text-amber-300', Icon: PlayCircle },
  bloqueada: { txt: 'Bloqueada', cls: 'bg-white/5 text-slate-500', Icon: Lock },
  em_preparo: { txt: 'Em preparação', cls: 'bg-violet-500/15 text-violet-300', Icon: Hourglass },
}

export function SeloAula({ status }: { status: StatusAula }) {
  const { txt, cls, Icon } = AULA[status]
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>
      <Icon size={12} /> {txt}
    </span>
  )
}

export function Cartao({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur ${className}`}>{children}</div>
}

export function Secao({ titulo, icone, children }: { titulo: string; icone?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-400/90">
        {icone}
        {titulo}
      </h2>
      {children}
    </section>
  )
}
