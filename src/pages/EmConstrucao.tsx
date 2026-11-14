import { Construction } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function EmConstrucao({ titulo, etapa, descricao }: { titulo: string; etapa: number; descricao: string }) {
  return (
    <div className="pt-10 text-center">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-amber-400/10">
        <Construction size={36} className="text-amber-400" />
      </div>
      <h1 className="mt-5 text-2xl font-extrabold text-white">{titulo}</h1>
      <p className="mt-2 inline-block rounded-full bg-white/5 px-3 py-1 text-sm font-semibold text-amber-300">Em construção (Etapa {etapa})</p>
      <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-slate-400">{descricao}</p>
      <Link to="/" className="mt-8 inline-flex h-12 items-center rounded-2xl bg-white/10 px-6 font-semibold text-white active:scale-95">
        Voltar ao painel
      </Link>
    </div>
  )
}
