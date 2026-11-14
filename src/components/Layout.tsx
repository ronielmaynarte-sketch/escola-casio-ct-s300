import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, BookOpen, Home, Music2, Settings } from 'lucide-react'
import { useProgresso } from '../lib/ProgressContext'
import { CONQUISTAS } from '../lib/curso'

const ITENS = [
  { to: '/', label: 'Painel', Icon: Home, end: true },
  { to: '/progresso', label: 'Progresso', Icon: BarChart3 },
  { to: '/dicionario', label: 'Dicionário', Icon: BookOpen },
  { to: '/musicas', label: 'Músicas', Icon: Music2 },
  { to: '/admin', label: 'Admin', Icon: Settings },
]

export default function Layout() {
  const { pathname } = useLocation()
  const { novasConquistas, limparNovasConquistas } = useProgresso()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  useEffect(() => {
    if (!novasConquistas.length) return
    const t = window.setTimeout(limparNovasConquistas, 4500)
    return () => window.clearTimeout(t)
  }, [novasConquistas, limparNovasConquistas])

  const conquista = CONQUISTAS.find((c) => c.id === novasConquistas[0])

  return (
    <div className="mx-auto min-h-dvh max-w-2xl">
      <main key={pathname} className="pagina pb-seguro px-4 pt-[max(env(safe-area-inset-top),1rem)]">
        <Outlet />
      </main>

      {conquista && (
        <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <button
            type="button"
            onClick={limparNovasConquistas}
            className="pagina flex max-w-sm items-center gap-3 rounded-2xl border border-amber-400/40 bg-slate-950/95 px-4 py-3 text-left shadow-2xl shadow-amber-500/20"
          >
            <span className="text-2xl" aria-hidden>
              🏆
            </span>
            <span>
              <span className="block text-xs font-bold uppercase tracking-wider text-amber-400">Nova conquista</span>
              <span className="block font-semibold text-white">{conquista.titulo}</span>
            </span>
          </button>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {ITENS.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition ${
                  isActive ? 'text-amber-400' : 'text-slate-400 active:text-white'
                }`
              }
            >
              <Icon size={22} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
