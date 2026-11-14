import { Hand, Mic, MicOff, Piano, Usb } from 'lucide-react'
import { useStatusEntrada } from '../lib/input/hub'

/** Mostra sempre qual fonte está ativa. Nunca finge reconhecimento. */
export default function SeloEntrada({ compacto = false }: { compacto?: boolean }) {
  const s = useStatusEntrada()
  const itens: { txt: string; cls: string; Icon: typeof Mic; id: string }[] = []
  if (s.microfone === 'ouvindo')
    itens.push(
      s.micMudo
        ? { id: 'mic', txt: 'Microfone pausado (app tocando)', cls: 'bg-slate-500/20 text-slate-300', Icon: MicOff }
        : { id: 'mic', txt: 'Microfone ouvindo', cls: 'bg-rose-500/20 text-rose-200', Icon: Mic },
    )
  else if (s.microfone === 'negado') itens.push({ id: 'mic', txt: 'Microfone bloqueado', cls: 'bg-red-500/20 text-red-200', Icon: MicOff })
  else if (s.microfone === 'pedindo') itens.push({ id: 'mic', txt: 'Pedindo microfone…', cls: 'bg-amber-500/20 text-amber-200', Icon: Mic })
  if (s.midi === 'conectado') itens.push({ id: 'midi', txt: `MIDI: ${s.dispositivosMidi[0] ?? 'teclado'}`, cls: 'bg-violet-500/20 text-violet-200', Icon: Usb })
  else if (s.midi === 'sem-dispositivo') itens.push({ id: 'midi', txt: 'MIDI: nenhum teclado ligado', cls: 'bg-white/5 text-slate-400', Icon: Usb })
  itens.push({ id: 'toque', txt: 'Toque na tela', cls: 'bg-white/5 text-slate-300', Icon: Hand })
  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="selo-entrada" aria-live="polite">
      {itens.map(({ id, txt, cls, Icon }) => (
        <span key={id} data-fonte={id} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
          <Icon size={11} /> {compacto && id === 'toque' && itens.length > 1 ? 'Tela' : txt}
        </span>
      ))}
      {s.ultimaFonte && !compacto && (
        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
          <Piano size={11} /> última nota: {s.ultimaFonte === 'microfone' ? 'microfone' : s.ultimaFonte === 'midi' ? 'MIDI' : 'tela'}
        </span>
      )}
    </div>
  )
}
