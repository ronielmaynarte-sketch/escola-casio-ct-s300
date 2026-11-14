import type { ReactNode } from 'react'

/** Converte **negrito** em <strong>. */
export function inline(texto: string): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**') ? (
      <strong key={i} className="font-semibold text-white">
        {parte.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{parte}</span>
    ),
  )
}

/** Parágrafo com marcação simples: linhas que começam com "- " viram lista. */
export function Paragrafo({ texto }: { texto: string }) {
  const linhas = texto.split('\n')
  const blocos: ReactNode[] = []
  let lista: string[] = []
  const fecharLista = () => {
    if (lista.length) {
      blocos.push(
        <ul key={`l${blocos.length}`} className="my-2 space-y-1.5 pl-1">
          {lista.map((l, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              <span>{inline(l)}</span>
            </li>
          ))}
        </ul>,
      )
      lista = []
    }
  }
  for (const l of linhas) {
    if (l.startsWith('- ')) lista.push(l.slice(2))
    else {
      fecharLista()
      if (l.trim()) blocos.push(<p key={`p${blocos.length}`}>{inline(l)}</p>)
    }
  }
  fecharLista()
  return <div className="space-y-1 leading-relaxed text-slate-300">{blocos}</div>
}
