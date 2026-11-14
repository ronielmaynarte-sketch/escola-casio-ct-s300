import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Eye,
  Hand,
  Hourglass,
  Lightbulb,
  ListChecks,
  Lock,
  Music,
  Piano,
  RotateCcw,
  Target,
  Trophy,
} from 'lucide-react'
import { useProgresso } from '../lib/ProgressContext'
import { acharAula, proximaAulaDepois, statusAula } from '../lib/curso'
import { cifraNota, nomeNota } from '../lib/audio'
import { Paragrafo, inline } from '../components/Texto'
import Teclado61 from '../components/Teclado61'
import Cronometro from '../components/Cronometro'
import Desafio, { exigeVerificacao } from '../components/Desafio'
import { Secao, SeloAula } from '../components/ui'

const NOME_DEDO = ['', 'polegar', 'indicador', 'médio', 'anelar', 'mínimo']

export default function AulaPagina() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { dados, concluirAula, marcarVerificacao, marcarUltimaAula, registrarAtividade } = useProgresso()
  const loc = acharAula(id)
  const status = loc ? statusAula(id, dados) : 'bloqueada'
  const [aviso, setAviso] = useState<string | null>(null)
  const [verificadoAgora, setVerificadoAgora] = useState(false)

  const acessivel = status === 'disponivel' || status === 'concluida'

  useEffect(() => {
    setVerificadoAgora(false)
    setAviso(null)
  }, [id])

  useEffect(() => {
    if (loc && acessivel) {
      marcarUltimaAula(loc.aula.id)
      registrarAtividade('aula_iniciada', `Abriu: ${loc.aula.titulo}`, loc.aula.id)
    }
    // Registrar só quando a aula muda
  }, [id, acessivel])

  const onAprovado = useCallback(() => {
    setVerificadoAgora(true)
    setAviso(null)
    if (loc) marcarVerificacao(loc.aula.id)
  }, [loc, marcarVerificacao])

  const teclasOrdenadas = useMemo(() => [...(loc?.aula.teclas ?? [])].sort((a, b) => a - b), [loc])

  if (!loc) {
    return (
      <div className="space-y-4 pt-6">
        <p className="text-slate-300">Aula não encontrada.</p>
        <Link to="/" className="text-amber-400">
          Voltar ao painel
        </Link>
      </div>
    )
  }

  const { aula, modulo, indice } = loc
  const voltar = (
    <Link to={`/modulo/${modulo.id}`} className="inline-flex h-11 items-center gap-2 text-sm text-slate-400 active:text-white">
      <ArrowLeft size={18} /> Módulo {modulo.numero}
    </Link>
  )

  if (!acessivel) {
    const preparo = status === 'em_preparo' || aula.status === 'em_preparo'
    return (
      <div className="space-y-5">
        {voltar}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/5">
            {status === 'bloqueada' ? <Lock size={28} className="text-slate-400" /> : <Hourglass size={28} className="text-violet-300" />}
          </div>
          <h1 className="mt-4 text-xl font-bold text-white">{aula.titulo}</h1>
          <div className="mt-2 flex justify-center">
            <SeloAula status={status} />
          </div>
          <p className="mt-3 text-sm text-slate-400">
            {status === 'bloqueada'
              ? 'Conclua a aula anterior para desbloquear esta.'
              : preparo
                ? 'Esta aula ainda está sendo preparada e será liberada em uma próxima etapa do curso.'
                : ''}
          </p>
        </div>
      </div>
    )
  }

  const precisaVerificar = exigeVerificacao(aula.criterio)
  const aprovado = verificadoAgora || Boolean(dados.verificacoes[aula.id])
  const jaConcluida = status === 'concluida'
  const proxima = proximaAulaDepois(aula.id)

  const conseguir = () => {
    if (precisaVerificar && !aprovado) {
      setAviso('Antes de avançar, passe no desafio no teclado acima. Sem pressa!')
      document.getElementById('desafio')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    concluirAula(aula.id)
    if (proxima) {
      const st = proxima.aula.status === 'pronta' ? `/aula/${proxima.aula.id}` : `/modulo/${proxima.modulo.id}`
      navigate(st)
    } else navigate('/')
  }

  const praticarMais = () => {
    registrarAtividade('praticar_mais', `Decidiu praticar mais: ${aula.titulo}`, aula.id)
    setAviso('Ótima decisão! Repita o exercício guiado com calma. Praticar devagar é o caminho mais rápido.')
    document.getElementById('exercicio')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const dedosLista = Object.entries(aula.dedos ?? {})
    .map(([m, d]) => ({ midi: Number(m), ...d }))
    .sort((a, b) => a.midi - b.midi)

  return (
    <article className="space-y-8">
      <div>
        {voltar}
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-400">
          Módulo {modulo.numero} · Aula {indice + 1} de {modulo.aulas.length}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight text-white">{aula.titulo}</h1>
        {jaConcluida && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
            <RotateCcw size={12} /> Aula concluída — você está revisando
          </p>
        )}
      </div>

      {aula.objetivo && (
        <div className="rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 to-transparent p-4">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
            <Target size={16} /> Objetivo
          </p>
          <p className="mt-1.5 font-medium text-white">{aula.objetivo}</p>
        </div>
      )}

      {aula.vaiAprender && aula.vaiAprender.length > 0 && (
        <Secao titulo="O que você vai aprender" icone={<Lightbulb size={16} />}>
          <ul className="space-y-2">
            {aula.vaiAprender.map((v, i) => (
              <li key={i} className="flex gap-2.5 text-slate-200">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-amber-400" /> {v}
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {aula.tempos && <Cronometro aulaId={aula.id} tempos={aula.tempos} />}

      {aula.explicacao && (
        <Secao titulo="Explicação" icone={<BookOpen size={16} />}>
          <div className="space-y-4 text-[15px]">
            {aula.explicacao.map((p, i) => (
              <Paragrafo key={i} texto={p} />
            ))}
          </div>
        </Secao>
      )}

      <Secao titulo="Demonstração visual" icone={<Eye size={16} />}>
        <p className="text-sm text-slate-400">
          Toque nas teclas para ouvir. As teclas destacadas são as desta aula; o número é o dedo.
        </p>
        <Teclado61 highlight={aula.teclas} fingers={aula.dedos} />
      </Secao>

      {teclasOrdenadas.length > 0 && (
        <Secao titulo="Teclas usadas" icone={<Piano size={16} />}>
          <div className="flex flex-wrap gap-2">
            {teclasOrdenadas.map((n) => (
              <span key={n} className="rounded-xl bg-white/5 px-3 py-2 text-sm">
                <strong className="text-white">{nomeNota(n)}</strong> <span className="text-slate-400">({cifraNota(n)})</span>
              </span>
            ))}
          </div>
        </Secao>
      )}

      {dedosLista.length > 0 && (
        <Secao titulo="Dedos" icone={<Hand size={16} />}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {dedosLista.map((d) => (
              <li key={d.midi} className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full font-black text-slate-950 ${
                    d.mao === 'esquerda' ? 'bg-sky-400' : 'bg-amber-400'
                  }`}
                >
                  {d.dedo}
                </span>
                <span className="text-slate-300">
                  <strong className="text-white">{nomeNota(d.midi)}</strong> ({cifraNota(d.midi)}) — dedo {d.dedo} ({NOME_DEDO[d.dedo] ?? ''}) da mão {d.mao}
                </span>
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {aula.exercicioGuiado && (
        <div id="exercicio" className="scroll-mt-4">
          <Secao titulo="Exercício guiado" icone={<ListChecks size={16} />}>
            <ol className="space-y-2.5">
              {aula.exercicioGuiado.map((p, i) => (
                <li key={i} className="flex gap-3 rounded-2xl bg-white/[0.04] p-3 text-slate-200">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-400 text-sm font-black text-slate-950">{i + 1}</span>
                  <span className="pt-0.5 leading-snug">{inline(p)}</span>
                </li>
              ))}
            </ol>
          </Secao>
        </div>
      )}

      {aula.criterio && (
        <div id="desafio" className="scroll-mt-4">
          <Secao titulo="Desafio" icone={<Trophy size={16} />}>
            <Desafio key={aula.id} aula={aula} aprovado={aprovado} onAprovado={onAprovado} />
          </Secao>
        </div>
      )}

      <div className="space-y-3 border-t border-white/10 pt-6">
        {aviso && <p className="rounded-2xl bg-white/5 p-3 text-sm text-amber-200">{aviso}</p>}
        <button
          type="button"
          onClick={conseguir}
          className={`flex h-16 w-full items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-[17px] font-black transition active:scale-[0.98] ${
            precisaVerificar && !aprovado
              ? 'bg-white/10 text-slate-400'
              : 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/20'
          }`}
        >
          <CheckCircle2 size={22} /> CONSEGUI! PRÓXIMA AULA
        </button>
        {precisaVerificar && !aprovado && (
          <p className="text-center text-xs text-slate-500">Libera depois que você passar no desafio no teclado.</p>
        )}
        <button
          type="button"
          onClick={praticarMais}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 font-bold text-slate-200 active:scale-[0.98]"
        >
          <Music size={20} /> PRECISO PRATICAR MAIS
        </button>
      </div>
    </article>
  )
}
