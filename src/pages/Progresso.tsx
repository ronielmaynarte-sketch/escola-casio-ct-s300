import { useRef } from 'react'
import { Award, CalendarDays, Clock, Download, Flame, History, Lock, Medal, Star, Trash2, Trophy, Upload } from 'lucide-react'
import { useProgresso } from '../lib/ProgressContext'
import { CONQUISTAS, formatarDuracao, progressoGeral, tempoTotal, totalConcluidas } from '../lib/curso'
import { calcularSequencia, hojeISO } from '../lib/storage'
import type { Atividade, ProgressData } from '../lib/storage'
import { Barra, Cartao, Secao } from '../components/ui'

const ICONES: Record<string, typeof Star> = { star: Star, medal: Medal, trophy: Trophy, flame: Flame, clock: Clock, award: Award }

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export default function Progresso() {
  const { dados, resetar } = useProgresso()
  const arquivo = useRef<HTMLInputElement>(null)

  const ultimos7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const chave = hojeISO(d)
    return { chave, rotulo: DIAS_SEMANA[d.getDay()], seg: dados.tempoPorDia[chave] ?? 0 }
  })
  const maxSeg = Math.max(60, ...ultimos7.map((d) => d.seg))

  const historico = [...dados.historico].reverse().slice(0, 60)
  const porData = historico.reduce<Record<string, Atividade[]>>((acc, a) => {
    const k = hojeISO(new Date(a.em))
    ;(acc[k] ??= []).push(a)
    return acc
  }, {})

  const exportar = () => {
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `progresso-escola-ct-s300-${hojeISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importar = async (f: File) => {
    try {
      const d = JSON.parse(await f.text()) as ProgressData
      if (d && typeof d === 'object' && 'aulasConcluidas' in d) {
        localStorage.setItem('escola-ct-s300:progresso:v1', JSON.stringify(d))
        window.location.reload()
      } else alert('Arquivo inválido.')
    } catch {
      alert('Não foi possível ler o arquivo.')
    }
  }

  return (
    <div className="space-y-7 pt-2">
      <header>
        <h1 className="text-2xl font-extrabold text-white">Seu progresso</h1>
        <p className="text-sm text-slate-400">Tudo é salvo automaticamente neste aparelho.</p>
      </header>

      <Cartao className="grid grid-cols-2 gap-4 p-4">
        <Num rotulo="Progresso geral" valor={`${progressoGeral(dados)}%`} />
        <Num rotulo="Aulas concluídas" valor={String(totalConcluidas(dados))} />
        <Num rotulo="Tempo total" valor={formatarDuracao(tempoTotal(dados))} />
        <Num rotulo="Sequência" valor={`${calcularSequencia(dados.diasAtivos)} dias`} />
        <Barra valor={progressoGeral(dados)} className="col-span-2" />
      </Cartao>

      <Secao titulo="Tempo por dia (7 dias)" icone={<CalendarDays size={16} />}>
        <Cartao className="p-4">
          <div className="flex h-36 items-end gap-2">
            {ultimos7.map((d) => (
              <div key={d.chave} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] text-slate-400">{d.seg ? Math.max(1, Math.round(d.seg / 60)) + 'm' : ''}</span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-orange-500 to-amber-300 transition-[height] duration-700"
                    style={{ height: `${(d.seg / maxSeg) * 100}%`, minHeight: d.seg ? 4 : 2, opacity: d.seg ? 1 : 0.15 }}
                  />
                </div>
                <span className={`text-[11px] ${d.chave === hojeISO() ? 'font-bold text-amber-400' : 'text-slate-400'}`}>{d.rotulo}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">O tempo vem do cronômetro das aulas.</p>
        </Cartao>
      </Secao>

      <Secao titulo="Conquistas" icone={<Trophy size={16} />}>
        <div className="grid grid-cols-2 gap-3">
          {CONQUISTAS.map((c) => {
            const em = dados.conquistas[c.id]
            const Icon = em ? ICONES[c.icone] ?? Star : Lock
            return (
              <div
                key={c.id}
                className={`rounded-2xl border p-3 ${em ? 'border-amber-400/40 bg-amber-400/10' : 'border-white/10 bg-white/[0.02] opacity-60'}`}
              >
                <Icon size={22} className={em ? 'text-amber-400' : 'text-slate-500'} />
                <p className="mt-2 text-sm font-bold leading-tight text-white">{c.titulo}</p>
                <p className="text-[11px] leading-snug text-slate-400">{c.descricao}</p>
                {em && <p className="mt-1 text-[10px] text-amber-300/80">{new Date(em).toLocaleDateString('pt-BR')}</p>}
              </div>
            )
          })}
        </div>
      </Secao>

      <Secao titulo="Histórico de atividades" icone={<History size={16} />}>
        {historico.length === 0 ? (
          <p className="rounded-2xl bg-white/[0.03] p-4 text-sm text-slate-400">Nenhuma atividade ainda. Comece pela primeira aula!</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(porData).map(([dia, itens]) => (
              <div key={dia}>
                <p className="mb-2 text-xs font-semibold text-slate-400">
                  {new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                </p>
                <ul className="space-y-1.5">
                  {itens.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
                      <span className="w-11 shrink-0 text-xs tabular-nums text-slate-500">
                        {new Date(a.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="min-w-0 flex-1 text-slate-200">{a.descricao}</span>
                      {a.segundos ? <span className="shrink-0 text-xs text-amber-300">{formatarDuracao(a.segundos)}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Secao>

      <Secao titulo="Seus dados">
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={exportar} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/5 text-sm font-semibold text-slate-200 active:bg-white/10">
            <Download size={18} /> Exportar
          </button>
          <button type="button" onClick={() => arquivo.current?.click()} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/5 text-sm font-semibold text-slate-200 active:bg-white/10">
            <Upload size={18} /> Importar
          </button>
          <input ref={arquivo} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirm('Apagar todo o progresso deste aparelho? Isso não pode ser desfeito.')) resetar()
          }}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/30 text-sm font-semibold text-rose-300 active:bg-rose-500/10"
        >
          <Trash2 size={18} /> Apagar progresso
        </button>
      </Secao>
    </div>
  )
}

function Num({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-2xl font-black text-white">{valor}</p>
      <p className="text-xs text-slate-400">{rotulo}</p>
    </div>
  )
}
