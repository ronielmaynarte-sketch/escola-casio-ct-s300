import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Coleta erros de console e exceções da página. */
export function vigiarConsole(page: Page): string[] {
  const erros: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') erros.push(m.text())
  })
  page.on('pageerror', (e) => erros.push(String(e)))
  return erros
}

/** Web MIDI falso: um "CT-S300" ligado por USB. window.__midi.enviar([status, nota, vel]) */
export async function instalarMidiFalso(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const entrada = { id: 'fake', name: 'Fake CT-S300 USB-MIDI', state: 'connected', onmidimessage: null as null | ((e: { data: Uint8Array }) => void) }
    const acesso = { inputs: new Map([['fake', entrada]]), outputs: new Map(), onstatechange: null }
    Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: () => Promise.resolve(acesso) })
    ;(window as unknown as { __midi: unknown }).__midi = {
      enviar: (bytes: number[]) => entrada.onmidimessage?.({ data: new Uint8Array(bytes) }),
    }
  })
}

export async function removerWebMidi(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // simula o Safari do iPhone (sem Web MIDI)
    delete (Navigator.prototype as unknown as Record<string, unknown>).requestMIDIAccess
  })
}

/** Teclas acesas agora (MIDI). */
export async function esperadas(page: Page): Promise<number[]> {
  return page.$$eval('[data-estado^="esperada"]', (els) => els.map((e) => Number((e as HTMLElement).dataset.midi)))
}

/** Espera até haver teclas acesas ou a avaliação aparecer. */
export async function aguardarPasso(page: Page): Promise<'passo' | 'fim'> {
  const h = await page.waitForFunction(
    () => {
      if (document.querySelector('[data-testid="avaliacao"]')) return 'fim'
      const t = document.querySelector('[data-testid="tela-tocar"]') as HTMLElement | null
      if (t && t.dataset.fase === 'tocando' && document.querySelector('[data-estado^="esperada"]')) return 'passo'
      return false
    },
    null,
    { timeout: 10_000 },
  )
  return (await h.jsonValue()) as 'passo' | 'fim'
}

/** Aperta várias teclas da tela ao mesmo tempo (multitoque com PointerEvents) e solta. */
export async function tocarNaTela(page: Page, midis: number[], segurarMs = 40): Promise<void> {
  await page.evaluate(
    async ({ midis, segurarMs }) => {
      const pts: { el: HTMLElement; x: number; y: number; id: number }[] = []
      // centraliza a rolagem entre as teclas (as duas mãos precisam estar visíveis, como para um dedo de verdade)
      const sc = document.querySelector('[data-testid="teclado-scroll"]') as HTMLElement
      const els = midis.map((m) => sc.querySelector(`[data-midi="${m}"]`) as HTMLElement)
      const xs = els.map((e) => e.offsetLeft + e.offsetWidth / 2)
      sc.scrollLeft = (Math.min(...xs) + Math.max(...xs)) / 2 - sc.clientWidth / 2
      els[0].scrollIntoView({ block: 'nearest', inline: 'nearest' })
      sc.scrollLeft = (Math.min(...xs) + Math.max(...xs)) / 2 - sc.clientWidth / 2
      midis.forEach((m, i) => {
        const el = els[i]
        const r = el.getBoundingClientRect()
        const preta = r.height < (el.parentElement!.getBoundingClientRect().height * 0.8)
        pts.push({ el, x: r.left + r.width / 2, y: r.top + r.height * (preta ? 0.5 : 0.88), id: 100 + i })
      })
      for (const p of pts) p.el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: p.id, clientX: p.x, clientY: p.y, pointerType: 'touch', isPrimary: p.id === 100 }))
      await new Promise((r) => setTimeout(r, segurarMs))
      for (const p of pts) p.el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: p.id, clientX: p.x, clientY: p.y, pointerType: 'touch' }))
    },
    { midis, segurarMs },
  )
}

export async function midiNotas(page: Page, midis: number[], segurarMs = 30): Promise<void> {
  await page.evaluate(
    async ({ midis, segurarMs }) => {
      const m = (window as unknown as { __midi: { enviar: (b: number[]) => void } }).__midi
      for (const n of midis) m.enviar([0x90, n, 100])
      await new Promise((r) => setTimeout(r, segurarMs))
      for (const n of midis) m.enviar([0x90, n, 0]) // note-on com velocidade 0 = note-off
    },
    { midis, segurarMs },
  )
}

/** Toca a música inteira acertando tudo. Retorna quantos passos foram tocados. */
export async function tocarTudo(page: Page, via: 'tela' | 'midi', limite = 600): Promise<number> {
  let n = 0
  while (n < limite) {
    const r = await aguardarPasso(page)
    if (r === 'fim') return n
    const notas = await esperadas(page)
    expect(notas.length).toBeGreaterThan(0)
    if (via === 'tela') await tocarNaTela(page, notas)
    else await midiNotas(page, notas)
    n++
    // espera o passo mudar (ou acabar)
    await page.waitForTimeout(15)
  }
  throw new Error('limite de passos')
}

/** Uma tecla visível que NÃO está acesa (para errar de propósito). */
export async function teclaErrada(page: Page, perto: number): Promise<number> {
  const acesas = new Set(await esperadas(page))
  for (const d of [2, -2, 1, -1, 3, -3, 4, -4]) if (!acesas.has(perto + d)) return perto + d
  return perto + 5
}
