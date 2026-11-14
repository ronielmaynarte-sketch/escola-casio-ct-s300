import { expect, test } from '@playwright/test'
import { gravarArquivoMidi } from '../../src/lib/musica/midiArquivo'
import { aguardarPasso, instalarMidiFalso, tocarTudo, vigiarConsole } from './ajudantes'

test('importar MIDI do aluno (Luiz Gonzaga): escolher faixas, salvar, aparece na biblioteca depois de recarregar e dá para tocar', async ({ page }) => {
  const erros = vigiarConsole(page)
  const mid = gravarArquivoMidi({
    divisao: 480,
    usPorSeminima: 600000,
    compasso: [2, 4],
    faixas: [
      { nome: 'Sanfona', notas: [67, 69, 71, 74, 74, 71, 72, 72, 69, 67, 67, 69, 71, 74].map((m, i) => ({ midi: m, inicioTick: i * 480, durTick: 440 })) },
      { nome: 'Baixo', canal: 1, notas: Array.from({ length: 7 }, (_, i) => ({ midi: i % 2 ? 50 : 43, inicioTick: i * 960, durTick: 900 })) },
    ],
  })
  await page.goto('./#/musicas?cat=gonzaga')
  await expect(page.getByTestId('biblioteca')).toContainText('direitos autorais')
  await page.getByTestId('importar-gonzaga').click()
  await page.getByTestId('arquivo-midi').setInputFiles({ name: 'minha-musica.mid', mimeType: 'audio/midi', buffer: Buffer.from(mid) })
  await expect(page.getByTestId('lista-faixas')).toContainText('Sanfona')
  await expect(page.getByTestId('lista-faixas')).toContainText('Baixo')
  await page.getByTestId('titulo-importacao').fill('Minha música importada')
  await expect(page.getByTestId('previa-importacao')).toContainText('21 notas')
  await page.getByTestId('salvar-importacao').click()
  await expect(page.getByTestId('musica-detalhe')).toContainText('Minha música importada')
  await page.reload()
  await page.goto('./#/musicas?cat=gonzaga')
  await expect(page.locator('[data-categoria="gonzaga"]')).toContainText('Minha música importada')
  await page.locator('[data-categoria="gonzaga"] a', { hasText: 'Minha música importada' }).click()
  await page.getByTestId('nivel-avancado').click()
  await page.getByTestId('modo-juntas').click()
  await page.getByTestId('iniciar-pratica').click()
  await page.getByTestId('botao-comecar').click()
  const n = await tocarTudo(page, 'tela')
  expect(n).toBe(14)
  await expect(page.getByTestId('pontuacao')).toContainText('100')
  expect(erros).toEqual([])
})

test('importar notação de texto', async ({ page }) => {
  const erros = vigiarConsole(page)
  await page.goto('./#/importar?cat=moderno')
  await page.getByTestId('aba-texto').click()
  await page.getByTestId('texto-importacao').fill('titulo: Escala de Dó\nbpm: 80\nmd: Do4:1 Re4 Mi4 Fa4 | Sol4:4\nme: C3:4 | G2:4')
  await page.getByTestId('salvar-texto').click()
  await expect(page.getByTestId('musica-detalhe')).toContainText('Escala de Dó')
  await page.getByTestId('texto-importacao').count()
  await page.goto('./#/importar')
  await page.getByTestId('aba-texto').click()
  await page.getByTestId('texto-importacao').fill('md: C9:1')
  await page.getByTestId('salvar-texto').click()
  await expect(page.getByTestId('erro-importacao')).toBeVisible()
  expect(erros).toEqual([])
})

test('modo ritmo: contagem, metrônomo e precisão do ritmo na avaliação', async ({ page }) => {
  const erros = vigiarConsole(page)
  await instalarMidiFalso(page)
  await page.goto('./#/tocar/ode-alegria?nivel=facil&modo=direita&ritmo=1&vel=1&secao=0')
  await page.getByTestId('botao-comecar').click()
  await expect(page.getByTestId('tela-tocar')).toHaveAttribute('data-fase', 'contagem')
  await expect(page.getByTestId('mensagem')).toContainText('Prepare-se')
  await expect(page.getByTestId('tela-tocar')).toHaveAttribute('data-fase', 'tocando', { timeout: 6000 })
  // Frase 1 da Ode à Alegria, no tempo (100 bpm = 600 ms por batida)
  await page.evaluate(async () => {
    const notas = [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62]
    const durs = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5, 0.5, 2]
    const m = (window as unknown as { __midi: { enviar: (b: number[]) => void } }).__midi
    const t0 = performance.now()
    let b = 0
    for (let i = 0; i < notas.length; i++) {
      const alvo = t0 + b * 600
      await new Promise((r) => setTimeout(r, Math.max(0, alvo - performance.now())))
      m.enviar([0x90, notas[i], 90])
      setTimeout(() => m.enviar([0x80, notas[i], 0]), 200)
      b += durs[i]
    }
  })
  await expect(page.getByTestId('avaliacao')).toBeVisible({ timeout: 5000 })
  const ritmo = await page.getByTestId('res-ritmo').textContent()
  expect(ritmo).toMatch(/^\d+%$/)
  expect(parseInt(ritmo!)).toBeGreaterThanOrEqual(80)
  expect(erros).toEqual([])
})

test('capturas de tela da tela de tocar (layout)', async ({ page }, info) => {
  await instalarMidiFalso(page)
  await page.goto('./#/tocar/fur-elise?nivel=avancado&modo=juntas')
  await page.getByTestId('botao-comecar').click()
  await aguardarPasso(page)
  await page.screenshot({ path: `tests/resultados/tela-tocar-${info.project.name}.png` })
  await page.goto('./#/')
  await page.screenshot({ path: `tests/resultados/painel-${info.project.name}.png`, fullPage: false })
})
