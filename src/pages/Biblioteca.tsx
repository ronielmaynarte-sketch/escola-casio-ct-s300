import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, FileUp, Hand, Library, Music2 } from 'lucide-react'
import { CATEGORIAS, todasAsMusicas } from '../lib/musica/catalogo'
import { NOME_MODO } from '../lib/musica/tipos'
import type { Modo } from '../lib/musica/tipos'
import { lerHistorico } from '../lib/treino/armazenamento'

const MODOS_TREINO: Modo[] = ['direita', 'esquerda', 'juntas']

export default function Biblioteca() {
  const [sp] = useSearchParams()
  const cat = sp.get('cat')
  const modo = MODOS_TREINO.includes(sp.get('modo') as Modo) ? (sp.get('modo') as Modo) : null
  const musicas = todasAsMusicas()
  const hist = lerHistorico()
  const melhor = (id: string) => Math.max(-1, ...hist.filter((h) => h.musicaId === id).map((h) => h.pontuacao))
  const categorias = CATEGORIAS.filter((c) => !cat || c.id === cat || (cat === 'classicas' && c.id === 'moderno'))
  const sufixo = modo ? `?modo=${modo}` : ''

  return (
    <div className="space-y-6 pt-2" data-testid="biblioteca">
      <header className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600">
          {modo ? <Hand size={24} className="text-white" /> : <Library size={24} className="text-white" />}
        </div>
        <div>
          <h1 className="text-xl font-extrabold leading-tight text-white">{modo ? `Treinar: ${NOME_MODO[modo].toLowerCase()}` : 'Biblioteca de músicas'}</h1>
          <p className="text-sm text-slate-400">{modo ? 'Escolha uma música para treinar neste modo.' : 'O professor espera você acertar cada nota.'}</p>
        </div>
      </header>

      {cat && (
        <Link to={`/musicas${sufixo}`} className="inline-block text-sm text-amber-400 underline">
          Ver todas as categorias
        </Link>
      )}

      {categorias.map((c) => {
        const lista = musicas.filter((m) => m.categoria === c.id)
        return (
          <section key={c.id} className="space-y-3" data-categoria={c.id}>
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-amber-400/90">{c.titulo}</h2>
            {c.importacao && (
              <div className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-3 text-sm text-violet-100">
                <p>{c.descricao}</p>
                <Link
                  to={`/importar?cat=${c.id === 'importadas' ? 'importadas' : c.id}`}
                  className="mt-2 inline-flex h-10 items-center gap-2 rounded-xl bg-violet-500 px-3 text-sm font-bold text-white active:scale-95"
                  data-testid={`importar-${c.id}`}
                >
                  <FileUp size={16} /> Importar arquivo MIDI (.mid) ou texto
                </Link>
              </div>
            )}
            {!c.importacao && <p className="-mt-1 text-xs text-slate-500">{c.descricao}</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              {lista.map((m) => {
                const b = melhor(m.id)
                return (
                  <Link
                    key={m.id}
                    to={`/musica/${m.id}${sufixo}`}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 active:scale-[0.99]"
                    data-testid={`musica-${m.id}`}
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-300">
                      <Music2 size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-white">{m.titulo}</p>
                      <p className="truncate text-[11px] text-slate-400">{m.compositor}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {m.tonalidade ? `${m.tonalidade} · ` : ''}
                        {m.compasso.join('/')} · {m.secoes.length} {m.secoes.length === 1 ? 'parte' : 'partes'}
                        {b >= 0 ? ` · melhor: ${b}%` : ''}
                      </p>
                    </div>
                    <ChevronRight size={18} className="text-slate-500" />
                  </Link>
                )
              })}
              {!lista.length && c.importacao && <p className="text-xs text-slate-500">Nenhuma música importada nesta categoria ainda.</p>}
            </div>
          </section>
        )
      })}
      <p className="text-[11px] leading-relaxed text-slate-500">
        Direitos autorais: só vêm prontas no app obras em domínio público (melodias tradicionais ou compositores falecidos há mais de 70 anos). Para outras músicas, importe um arquivo seu; ele fica só neste aparelho.
      </p>
    </div>
  )
}
