import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileMusic, FileText, Save } from 'lucide-react'
import { lerArquivoMidi } from '../lib/musica/midiArquivo'
import type { ArquivoMidi } from '../lib/musica/midiArquivo'
import { importarMidi, importarTexto } from '../lib/musica/importar'
import type { Aviso } from '../lib/musica/importar'
import { nomeComOitava } from '../lib/musica/notas'
import type { Categoria, MusicaDef } from '../lib/musica/tipos'
import { salvarMusicaImportada } from '../lib/treino/armazenamento'
import { useConfig } from '../lib/treino/useConfig'

const CATS: { id: Categoria; nome: string }[] = [
  { id: 'gonzaga', nome: 'Luiz Gonzaga' },
  { id: 'moderno', nome: 'Piano moderno' },
  { id: 'importadas', nome: 'Minhas músicas' },
]

const EXEMPLO = `titulo: Minha melodia
bpm: 90
compasso: 4/4
secao: Parte 1
md: E4:1 D4 C4 D4 | E4 E4 E4:2
me: C3:4 | C3:4
secao: Parte 2
md: D4:1 D4 D4:2 | E4:1 G4 G4:2
harmonia: G:4 C:4`

export default function Importar() {
  const [sp] = useSearchParams()
  const navigate = useNavigate()
  const [config] = useConfig()
  const catInicial = CATS.some((c) => c.id === sp.get('cat')) ? (sp.get('cat') as Categoria) : 'importadas'
  const [aba, setAba] = useState<'midi' | 'texto'>('midi')
  const [categoria, setCategoria] = useState<Categoria>(catInicial)
  const [arq, setArq] = useState<ArquivoMidi | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [titulo, setTitulo] = useState('')
  const [separacao, setSeparacao] = useState<'faixas' | 'altura'>('faixas')
  const [fDir, setFDir] = useState<number | null>(null)
  const [fEsq, setFEsq] = useState<number | null>(null)
  const [divisao, setDivisao] = useState(config.divisao)
  const [quant, setQuant] = useState(0.25)
  const [transpor, setTranspor] = useState<'auto' | number>('auto')
  const [porSecao, setPorSecao] = useState(4)
  const [texto, setTexto] = useState(EXEMPLO)

  const abrir = async (f: File) => {
    setErro(null)
    try {
      const a = lerArquivoMidi(await f.arrayBuffer())
      const comNotas = a.faixas.filter((x) => x.notas.length)
      if (!comNotas.length) throw new Error('O arquivo não tem notas.')
      setArq(a)
      setTitulo(f.name.replace(/\.(mid|midi)$/i, ''))
      // sugestão: faixa mais aguda = direita, mais grave = esquerda; uma faixa só = dividir por altura
      const media = (i: number) => a.faixas[i].notas.reduce((s, n) => s + n.midi, 0) / Math.max(1, a.faixas[i].notas.length)
      const ord = comNotas.map((x) => x.indice).sort((x, y) => media(y) - media(x))
      if (ord.length === 1) {
        setSeparacao('altura')
        setFDir(ord[0])
        setFEsq(null)
      } else {
        setSeparacao('faixas')
        setFDir(ord[0])
        setFEsq(ord[ord.length - 1])
      }
    } catch (e) {
      setArq(null)
      setErro((e as Error).message)
    }
  }

  const previa = useMemo<{ musica: MusicaDef; avisos: Aviso[] } | { erro: string } | null>(() => {
    if (!arq) return null
    try {
      return importarMidi(arq, {
        titulo: titulo || 'Música importada',
        categoria,
        separacao,
        faixaDireita: fDir,
        faixaEsquerda: fEsq,
        divisao,
        quantizacao: quant * (arq.compasso?.[1] ?? 4) / 4,
        transpor,
        compassosPorSecao: porSecao,
      })
    } catch (e) {
      return { erro: (e as Error).message }
    }
  }, [arq, titulo, categoria, separacao, fDir, fEsq, divisao, quant, transpor, porSecao])

  const salvar = (m: MusicaDef) => {
    if (!salvarMusicaImportada(m)) {
      setErro('Não deu para salvar: o armazenamento do navegador está cheio. Apague músicas importadas antigas.')
      return
    }
    navigate(`/musica/${m.id}`)
  }

  const salvarTexto = () => {
    setErro(null)
    try {
      salvar(importarTexto(texto, categoria))
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  return (
    <div className="space-y-5 pt-2" data-testid="importar">
      <div className="flex items-start gap-3">
        <Link to="/musicas" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-white" aria-label="Voltar">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-white">Importar música</h1>
          <p className="text-sm text-slate-400">Use um arquivo que é seu. Ele fica salvo só neste aparelho.</p>
        </div>
      </div>

      <div className="flex gap-2">
        {CATS.map((c) => (
          <button key={c.id} type="button" onClick={() => setCategoria(c.id)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${categoria === c.id ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-slate-200'}`}>
            {c.nome}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setAba('midi')} className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold ${aba === 'midi' ? 'bg-sky-500 text-white' : 'bg-white/10 text-slate-200'}`}>
          <FileMusic size={16} /> Arquivo MIDI
        </button>
        <button type="button" onClick={() => setAba('texto')} className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold ${aba === 'texto' ? 'bg-sky-500 text-white' : 'bg-white/10 text-slate-200'}`} data-testid="aba-texto">
          <FileText size={16} /> Texto (notas)
        </button>
      </div>

      {erro && <p className="rounded-xl bg-red-500/15 p-3 text-sm text-red-200" data-testid="erro-importacao">{erro}</p>}

      {aba === 'midi' && (
        <div className="space-y-4">
          <label className="block rounded-2xl border-2 border-dashed border-white/15 p-5 text-center text-sm text-slate-300">
            Escolha um arquivo <strong>.mid</strong> (MIDI tipo 0 ou 1)
            <input type="file" accept=".mid,.midi,audio/midi,audio/x-midi" className="mt-3 block w-full text-xs" onChange={(e) => e.target.files?.[0] && void abrir(e.target.files[0])} data-testid="arquivo-midi" />
          </label>

          {arq && (
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-200">
              <label className="block">
                Nome da música
                <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="mt-1 h-10 w-full rounded-lg bg-slate-900 px-3 text-white" data-testid="titulo-importacao" />
              </label>
              <div>
                <p className="mb-1 font-semibold">Faixas do arquivo</p>
                <ul className="space-y-1 text-xs text-slate-400" data-testid="lista-faixas">
                  {arq.faixas.filter((f) => f.notas.length).map((f) => (
                    <li key={f.indice}>
                      {f.indice}. {f.nome} — {f.notas.length} notas ({nomeComOitava(Math.min(...f.notas.map((n) => n.midi)), config.estiloNome)} a {nomeComOitava(Math.max(...f.notas.map((n) => n.midi)), config.estiloNome)})
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={separacao === 'faixas'} onChange={() => setSeparacao('faixas')} /> Uma faixa para cada mão
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={separacao === 'altura'} onChange={() => setSeparacao('altura')} /> Dividir pela altura
                </label>
              </div>
              {separacao === 'faixas' ? (
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['Mão direita', fDir, setFDir],
                      ['Mão esquerda', fEsq, setFEsq],
                    ] as const
                  ).map(([rot, v, set]) => (
                    <label key={rot} className="block text-xs">
                      {rot}
                      <select value={v ?? ''} onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))} className="mt-1 h-9 w-full rounded-lg bg-slate-900 px-2 text-sm text-white">
                        <option value="">(nenhuma)</option>
                        {arq.faixas.filter((f) => f.notas.length).map((f) => (
                          <option key={f.indice} value={f.indice}>
                            {f.indice}. {f.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              ) : (
                <label className="block text-xs">
                  Ponto de divisão: notas a partir de <strong>{nomeComOitava(divisao, config.estiloNome)}</strong> vão para a mão direita
                  <input type="range" min={48} max={72} value={divisao} onChange={(e) => setDivisao(Number(e.target.value))} className="w-full accent-amber-400" />
                </label>
              )}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <label>
                  Quantizar
                  <select value={quant} onChange={(e) => setQuant(Number(e.target.value))} className="mt-1 h-9 w-full rounded-lg bg-slate-900 px-1 text-white">
                    <option value={1}>semínima</option>
                    <option value={0.5}>colcheia</option>
                    <option value={0.25}>semicolcheia</option>
                    <option value={1 / 3}>tercina</option>
                  </select>
                </label>
                <label>
                  Transpor
                  <select value={String(transpor)} onChange={(e) => setTranspor(e.target.value === 'auto' ? 'auto' : Number(e.target.value))} className="mt-1 h-9 w-full rounded-lg bg-slate-900 px-1 text-white">
                    <option value="auto">automático</option>
                    {[-24, -12, -2, -1, 0, 1, 2, 12, 24].map((v) => (
                      <option key={v} value={v}>
                        {v > 0 ? '+' : ''}
                        {v} semitons
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Parte a cada
                  <select value={porSecao} onChange={(e) => setPorSecao(Number(e.target.value))} className="mt-1 h-9 w-full rounded-lg bg-slate-900 px-1 text-white">
                    {[2, 4, 8].map((v) => (
                      <option key={v} value={v}>
                        {v} compassos
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {previa && 'erro' in previa && <p className="text-red-300">{previa.erro}</p>}
              {previa && 'musica' in previa && (
                <div className="space-y-2" data-testid="previa-importacao">
                  <p className="text-xs text-slate-300">
                    {previa.musica.niveis.avancado.length} notas · {previa.musica.secoes.length} partes · {previa.musica.bpm} bpm · compasso {previa.musica.compasso.join('/')}
                  </p>
                  {previa.avisos.map((a) => (
                    <p key={a.texto} className="text-xs text-amber-300">
                      • {a.texto}
                    </p>
                  ))}
                  <button type="button" onClick={() => salvar(previa.musica)} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 font-black text-slate-950" data-testid="salvar-importacao">
                    <Save size={18} /> Salvar e praticar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {aba === 'texto' && (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-slate-400">
            Escreva as notas: <code>C4</code> ou <code>Do4</code> (Dó central = Dó4), duração depois de dois-pontos (<code>:1</code> = 1 tempo, <code>:0.5</code> = meio), acorde entre colchetes{' '}
            <code>[C3 E3 G3]:2</code>, pausa <code>R:1</code>, dedo com barra <code>E4/3</code>. Linhas <code>md:</code> (mão direita), <code>me:</code> (mão esquerda) e <code>harmonia:</code> (cifras, opcional).
          </p>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={11} className="w-full rounded-2xl bg-slate-900 p-3 font-mono text-xs text-white" data-testid="texto-importacao" />
          <button type="button" onClick={salvarTexto} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 font-black text-slate-950" data-testid="salvar-texto">
            <Save size={18} /> Salvar e praticar
          </button>
        </div>
      )}
    </div>
  )
}
