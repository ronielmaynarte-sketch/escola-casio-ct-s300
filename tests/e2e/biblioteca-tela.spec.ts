import { expect, test } from '@playwright/test'
import { aguardarPasso, esperadas, teclaErrada, tocarNaTela, tocarTudo, vigiarConsole } from './ajudantes'

test('menu → biblioteca → música fácil inteira pelo teclado da tela, erro fica vermelho e não avança, avaliação e histórico persistem', async ({ page }) => {
  const erros = vigiarConsole(page)
  await page.goto('./#/')
  await expect(page.getByTestId('menu-principal')).toBeVisible()
  for (const t of ['Aprender do zero', 'Biblioteca de músicas', 'Músicas de Luiz Gonzaga', 'Músicas famosas de piano', 'Treinar mão direita', 'Treinar mão esquerda', 'Treinar as duas mãos', 'Meu progresso', 'Configurações'])
    await expect(page.getByTestId('menu-principal').getByText(t, { exact: true })).toBeVisible()
  await page.getByTestId('menu-principal').getByText('Biblioteca de músicas').click()
  await expect(page.getByTestId('biblioteca')).toBeVisible()
  await page.getByTestId('musica-brilha-estrelinha').click()
  await page.getByTestId('nivel-facil').click()
  await page.getByTestId('modo-direita').click()
  await page.getByTestId('iniciar-pratica').click()
  await expect(page.getByTestId('tela-tocar')).toBeVisible()
  // antes de começar já mostra as próximas notas
  await expect(page.getByTestId('passo-atual')).toContainText('Dó')
  await page.getByTestId('botao-comecar').click()
  await aguardarPasso(page)

  // erro proposital
  const certas = await esperadas(page)
  expect(certas).toEqual([60])
  const errada = await teclaErrada(page, 60)
  await tocarNaTela(page, [errada], 60)
  await expect(page.locator(`[data-testid="teclado-scroll"] [data-midi="${errada}"]`)).toHaveAttribute('data-estado', 'errada')
  await expect(page.getByTestId('mensagem')).toHaveAttribute('data-tipo', 'erro')
  await expect(page.getByTestId('mensagem')).toContainText('a nota certa é Dó')
  await expect(page.getByTestId('contador-erros')).toContainText('1')
  expect(await esperadas(page)).toEqual([60]) // não avançou
  await expect(page.getByTestId('contador-acertos')).toContainText('0')

  const passos = await tocarTudo(page, 'tela')
  expect(passos).toBe(42)
  await expect(page.getByTestId('avaliacao')).toBeVisible()
  await expect(page.getByTestId('res-certas')).toHaveText('42')
  await expect(page.getByTestId('res-erradas')).toHaveText('1')
  await expect(page.getByTestId('pontuacao')).toContainText('98')
  await expect(page.getByTestId('pontos-melhorar')).toContainText('Compasso 1')

  // histórico persiste depois de recarregar
  await page.goto('./#/meu-progresso')
  await page.reload()
  await expect(page.getByTestId('historico-treino')).toContainText('Brilha, Brilha, Estrelinha')
  await expect(page.getByTestId('total-sessoes')).toHaveText('1')
  await expect(page.getByTestId('grafico-evolucao')).toBeVisible()
  expect(erros).toEqual([])
})

test('lição L1 → avaliação oferece a próxima lição; modo desafio esconde dicas mas acusa erro', async ({ page }) => {
  const erros = vigiarConsole(page)
  await page.goto('./#/musica/ode-alegria')
  await page.getByTestId('licao-L1').click()
  await page.getByTestId('botao-comecar').click()
  await tocarTudo(page, 'tela')
  await expect(page.getByTestId('avaliacao')).toBeVisible()
  await expect(page.getByText('Próxima lição (L2)')).toBeVisible()

  await page.goto('./#/tocar/ode-alegria?nivel=facil&modo=desafio')
  await page.getByTestId('botao-comecar').click()
  await page.waitForTimeout(200)
  expect(await esperadas(page)).toEqual([]) // nada aceso
  // desafio = mãos juntas (Mi + baixo Dó3), sem mostrar quais
  await expect(page.getByTestId('passo-atual')).toHaveText('??')
  await tocarNaTela(page, [62]) // Ré em vez de Mi
  await expect(page.locator('[data-testid="teclado-scroll"] [data-midi="62"]')).toHaveAttribute('data-estado', 'errada')
  await expect(page.getByTestId('mensagem')).toContainText('Errou: você tocou Ré')
  await expect(page.getByTestId('mensagem')).not.toContainText('Mi')
  await tocarNaTela(page, [64, 48])
  await expect(page.getByTestId('contador-acertos')).toContainText('2')
  expect(erros).toEqual([])
})
