import { expect, test } from '@playwright/test'
import { aguardarPasso, esperadas, instalarMidiFalso, midiNotas, removerWebMidi, tocarTudo, vigiarConsole } from './ajudantes'

test('Web MIDI simulado: música inteira com as duas mãos, acorde separado não conta, nota errada não avança', async ({ page }) => {
  const erros = vigiarConsole(page)
  await instalarMidiFalso(page)
  await page.goto('./#/tocar/ode-alegria?nivel=intermediario&modo=juntas')
  await expect(page.getByTestId('selo-entrada')).toContainText('MIDI: Fake CT-S300 USB-MIDI')
  await page.getByTestId('botao-comecar').click()
  await aguardarPasso(page)
  // primeiro passo: Mi4 (direita) + Dó3 (esquerda) juntos
  const passo1 = (await esperadas(page)).sort((a, b) => a - b)
  expect(passo1).toEqual([48, 64])
  await expect(page.locator('[data-midi="64"]').first()).toHaveAttribute('data-estado', 'esperada-direita')
  await expect(page.locator('[data-midi="48"]').first()).toHaveAttribute('data-estado', 'esperada-esquerda')

  // acorde com as notas separadas por 400 ms: não completa
  await page.evaluate(async () => {
    const m = (window as unknown as { __midi: { enviar: (b: number[]) => void } }).__midi
    m.enviar([0x90, 48, 90])
    await new Promise((r) => setTimeout(r, 400))
    m.enviar([0x90, 64, 90])
    await new Promise((r) => setTimeout(r, 50))
    m.enviar([0x80, 48, 0])
    m.enviar([0x80, 64, 0])
  })
  await expect(page.getByTestId('mensagem')).toContainText('juntas')
  expect((await esperadas(page)).sort((a, b) => a - b)).toEqual([48, 64])

  // nota errada pelo MIDI (Fá4)
  await midiNotas(page, [65])
  await expect(page.locator('[data-testid="teclado-scroll"] [data-midi="65"]')).toHaveAttribute('data-estado', 'errada')
  await expect(page.getByTestId('contador-erros')).toContainText('1')
  expect((await esperadas(page)).sort((a, b) => a - b)).toEqual([48, 64])

  const passos = await tocarTudo(page, 'midi')
  expect(passos).toBeGreaterThan(50)
  await expect(page.getByTestId('avaliacao')).toBeVisible()
  await expect(page.getByTestId('res-erradas')).toHaveText('1')
  expect(erros).toEqual([])
})

test('modos de mão: só esquerda acende só verde; mãos separadas vai da direita para a esquerda; tecla aparece apertada', async ({ page }) => {
  const erros = vigiarConsole(page)
  await instalarMidiFalso(page)
  await page.goto('./#/tocar/canon-pachelbel?nivel=avancado&modo=esquerda')
  await page.getByTestId('botao-comecar').click()
  await aguardarPasso(page)
  expect(await page.locator('[data-estado="esperada-direita"]').count()).toBe(0)
  expect(await page.locator('[data-estado="esperada-esquerda"]').count()).toBe(2) // Ré3 + Lá3
  // nota da mão direita é ignorada no modo "só esquerda"
  await midiNotas(page, [74])
  await expect(page.getByTestId('contador-erros')).toContainText('0')
  // tecla segurada no teclado real aparece apertada
  await page.evaluate(() => (window as unknown as { __midi: { enviar: (b: number[]) => void } }).__midi.enviar([0x90, 79, 80]))
  await expect(page.locator('[data-testid="teclado-scroll"] [data-midi="79"]')).toHaveAttribute('data-estado', 'pressionada')
  await page.evaluate(() => (window as unknown as { __midi: { enviar: (b: number[]) => void } }).__midi.enviar([0x80, 79, 0]))

  await page.goto('./#/tocar/brilha-estrelinha?nivel=intermediario&modo=separadas&secao=0')
  await page.getByTestId('botao-comecar').click()
  await expect(page.getByTestId('rotulo-trecho')).toContainText('mão direita')
  await aguardarPasso(page)
  expect(await page.locator('[data-estado="esperada-esquerda"]').count()).toBe(0)
  for (let i = 0; i < 14; i++) {
    await aguardarPasso(page)
    await midiNotas(page, await esperadas(page))
    await page.waitForTimeout(15)
  }
  await expect(page.getByTestId('rotulo-trecho')).toContainText('mão esquerda')
  await aguardarPasso(page)
  expect(await page.locator('[data-estado="esperada-direita"]').count()).toBe(0)
  expect(await page.locator('[data-estado="esperada-esquerda"]').count()).toBeGreaterThan(0)
  await tocarTudo(page, 'midi')
  await expect(page.getByTestId('avaliacao')).toBeVisible()
  expect(erros).toEqual([])
})

test('sem Web MIDI (como no iPhone): mostra "não suportado neste navegador" e continua com a tela', async ({ page }) => {
  const erros = vigiarConsole(page)
  await removerWebMidi(page)
  await page.goto('./#/config')
  await expect(page.getByTestId('midi-nao-suportado')).toContainText('não suportado neste navegador')
  await page.goto('./#/tocar/ode-alegria?nivel=facil&modo=direita')
  await expect(page.getByTestId('botao-midi')).toContainText('não suportado')
  await expect(page.getByTestId('selo-entrada')).toContainText('Toque na tela')
  await expect(page.getByTestId('selo-entrada')).not.toContainText('Microfone ouvindo')
  expect(erros).toEqual([])
})
