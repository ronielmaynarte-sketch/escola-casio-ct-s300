// Microfone com áudio falso: o Chromium lê um WAV gerado aqui (notas sintetizadas de "piano")
// como se fosse o microfone. Não substitui o teste com iPhone + CT-S300 de verdade.
import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SR, concatenar, ruido, silencio, somar, tom, wav } from '../unit/sinais'
import { vigiarConsole } from './ajudantes'

const dir = join(process.cwd(), 'tests', 'resultados')
mkdirSync(dir, { recursive: true })
const arquivo = join(dir, 'mic-do-central.wav')
// Dó4 (Dó central) tocado a cada 0,7 s, com ruído de fundo, por ~20 s (o Chromium repete o arquivo)
const partes: Float32Array[] = [silencio(0.3)]
for (let i = 0; i < 28; i++) partes.push(tom(60, { dur: 0.55, amp: 0.35 }), silencio(0.15))
const sinal = concatenar(...partes)
writeFileSync(arquivo, wav(somar(sinal, ruido(sinal.length, 0.004)), SR))

test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${arquivo}`, '--autoplay-policy=no-user-gesture-required'] },
})

test('calibração: liga o microfone com um toque e reconhece o Dó central', async ({ page }) => {
  const erros = vigiarConsole(page)
  await page.goto('./#/config')
  await page.getByTestId('calibrar-ligar').click()
  await expect(page.getByTestId('selo-entrada').first()).toContainText(/Microfone (ouvindo|pausado)/)
  await expect(page.getByTestId('nota-ouvida')).toHaveText('Dó4', { timeout: 15_000 })
  await expect(page.getByTestId('calibrar-teste')).toContainText('Perfeito')
  expect(erros).toEqual([])
})

test('tocar junto pelo microfone: Dó Dó avança, depois o Dó (errado no lugar do Sol) não avança', async ({ page }) => {
  const erros = vigiarConsole(page)
  await page.addInitScript(() => localStorage.setItem('escola-ct-s300:treino-config:v1', JSON.stringify({ fonte: 'microfone' })))
  await page.goto('./#/tocar/brilha-estrelinha?nivel=facil&modo=direita')
  await page.getByTestId('botao-comecar').click()
  await expect(page.getByTestId('selo-entrada')).toContainText(/Microfone/)
  await expect(page.getByTestId('contador-acertos')).toContainText('2', { timeout: 15_000 })
  await expect(page.getByTestId('mensagem')).toContainText('a nota certa é Sol', { timeout: 10_000 })
  await expect(page.getByTestId('contador-erros')).not.toContainText('✗ 0')
  // continua parado no Sol
  await page.waitForTimeout(1500)
  await expect(page.getByTestId('contador-acertos')).toContainText('2')
  expect(await page.$$eval('[data-estado^="esperada"]', (e) => e.map((x) => (x as HTMLElement).dataset.midi))).toEqual(['67'])
  expect(erros).toEqual([])
})
