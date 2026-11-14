# Escola Casio CT-S300

Aplicativo web (PWA, pensado para celular) para aprender teclado do zero no **Casio CT-S300**.
Sem IA e sem APIs pagas: todo o conteúdo fica em arquivos JSON e o progresso é salvo no próprio aparelho.

## Etapas

| Etapa | Situação | O que entra |
|---|---|---|
| 1 | **Pronta** | Painel do aluno, módulos, aulas, teclado 2D com som, cronômetro, desafios interativos, progresso, histórico e conquistas. Conteúdo completo dos Módulos 1 e 2 (17 aulas). |
| 2 | Base pronta | Escrever o conteúdo das demais aulas (só editar `src/content/modules.json`) e o Dicionário. |
| 3 | A fazer | Teclado 3D (Three.js) substituindo o `<Teclado61>` 2D, com a mesma API. |
| 4 | A fazer | Biblioteca de músicas. |
| 5 | A fazer | Login, banco de dados (ex.: Supabase) e painel Admin. |

## Como rodar

```bash
npm install
npm run dev      # desenvolvimento
npm run build    # gera a pasta dist/ (verifica TypeScript antes)
npm run preview  # testa a versão gerada
```

O `vite.config.ts` usa `base: './'` e o app usa `HashRouter` (endereços com `#/`).
Assim a pasta `dist/` funciona em qualquer subpasta, por exemplo no GitHub Pages em
`https://<usuario>.github.io/escola-casio-ct-s300/`, sem configuração extra.

## Tecnologias

Vite · React · TypeScript · Tailwind CSS 4 · react-router (HashRouter) · lucide-react · Web Audio API.

## Arquitetura

```
src/
  content/              CONTEÚDO DO CURSO (separado do código)
    modules.json        12 módulos e 110 aulas
    achievements.json   lista de conquistas
    course.json         nome do curso, teclado, faixa de notas (36–96 = C2–C7)
  lib/
    types.ts            tipos do conteúdo (Modulo, Aula, Criterio...)
    curso.ts            regras: desbloqueio, status, % de progresso, próxima aula, conquistas
    storage.ts          interface ProgressStore + LocalStorageStore
    ProgressContext.tsx estado do aluno para as telas (salvamento automático)
    audio.ts            som de piano sintetizado (Web Audio) e nomes das notas
  components/
    Teclado61.tsx       teclado de 61 teclas 2D (toque/mouse, multitoque, som)
    Desafio.tsx         verificação: nota, sequência, acorde, quiz, manual
    Cronometro.tsx      cronômetro por fase (registra tempo real; não bloqueia)
    Layout.tsx          navegação inferior e aviso de conquista
    Texto.tsx, ui.tsx   textos com **negrito**/listas, selos, barras, cartões
  pages/
    Painel.tsx          tela inicial do aluno
    ModuloPagina.tsx    aulas de um módulo
    AulaPagina.tsx      aula completa
    Progresso.tsx       histórico, tempo por dia, conquistas, exportar/importar
    EmConstrucao.tsx    Dicionário, Músicas e Admin (ainda não feitos)
public/                 manifest, ícones e service worker (PWA)
```

### Formato de uma aula (`modules.json`)

```jsonc
{
  "id": "m1-a7",
  "titulo": "Encontrando o Dó central",
  "status": "pronta",                 // ou "em_preparo" (aparece como "Em preparação")
  "objetivo": "…",
  "vaiAprender": ["…"],
  "explicacao": ["parágrafo com **negrito**", "lista:\n- item\n- item"],
  "teclas": [60],                     // números MIDI; Dó central (C4) = 60
  "dedos": { "60": { "dedo": 1, "mao": "direita" } },
  "exercicioGuiado": ["passo 1", "passo 2"],
  "tempos": { "explicacao": 3, "observacao": 2, "pratica": 4, "exercicio": 3 },  // minutos
  "desafio": "Toque o Dó central no teclado da tela.",
  "criterio": { "tipo": "nota", "nota": 60, "instrucao": "…" }
}
```

Tipos de `criterio`:

- `manual` – o próprio aluno decide quando conseguiu.
- `nota` – `{ "nota": 60 }` tocar uma tecla.
- `sequencia` – `{ "notas": [60, 62, 64] }` tocar em ordem (nota errada não zera, só avisa).
- `acorde` – `{ "notas": [48, 60] }` tocar juntas (seguradas ao mesmo tempo ou com até 0,6 s de diferença).
- `quiz` – `{ "perguntas": [{ "pergunta", "opcoes": [], "correta": 0 }] }`.

Para `nota`, `sequencia` e `acorde` o botão **CONSEGUI! PRÓXIMA AULA** só conclui depois que o desafio foi aprovado no teclado. O quiz é mostrado e registrado, mas não trava a conclusão.

Para liberar uma aula nova basta preencher os campos e trocar `"status"` para `"pronta"`.

### Regras de progresso

- A aula N+1 só abre quando a aula N foi concluída.
- Um módulo só abre quando o módulo anterior foi totalmente concluído.
- Aulas concluídas podem ser repetidas quantas vezes quiser.
- Aulas `em_preparo` nunca aparecem como prontas.
- Sequência de dias: conta dias com estudo, desafio ou aula concluída (só abrir uma aula não conta).

### Dados do aluno e futura troca para Supabase

Todas as telas usam a interface `ProgressStore` (`src/lib/storage.ts`):

```ts
interface ProgressStore {
  load(): Promise<ProgressData>
  save(data: ProgressData): Promise<void>
  reset(): Promise<void>
}
```

Hoje a implementação é `LocalStorageStore` (chave `escola-ct-s300:progresso:v1`).
Para usar nuvem, crie `SupabaseStore` com os mesmos três métodos e passe para
`<ProgressProvider store={new SupabaseStore(...)}>` em `App.tsx`. Nenhuma tela precisa mudar.
Na tela Progresso há **Exportar/Importar** para fazer backup em arquivo.

### Teclado (para a Etapa 3)

`<Teclado61 highlight={[60,62]} fingers={{ "60": { dedo: 1, mao: "direita" } }} onNote={(midi, ligado) => …} />`

O modelo 3D deve receber as mesmas props para substituir o 2D sem mexer nas aulas.

## Fatos do CT-S300 usados no conteúdo

Baseados no manual oficial em português (CTS300): 61 teclas (36 brancas, 25 pretas), C2–C7; botão **P**
(segure para desligar); **VOLUME −/+**; **HOME** + disco para escolher sons (001 STEREO GRAND PIANO);
400 sons, 77 ritmos, 60 canções; 3 botões abaixo do visor com função variável; **▶■**, **TEMPO**,
**SUSTAIN**, **MY SETUP**, **FUNCTION**; roda de pitch bend à esquerda; atrás: DC 9.5V, PHONES/OUTPUT,
AUDIO IN, PEDAL, USB; 6 pilhas AA ou adaptador AD-E95100L.
O CT-S300 **não tem** botões separados de Tone, Song Bank, Piano/Organ, Metronome ou Transpose,
nem teclado numérico, nem layer/split — o conteúdo não deve citar esses botões.

## Limitações conhecidas

- O som é sintetizado (aproximação de piano), não é o som real do CT-S300.
- O progresso fica só no aparelho/navegador até existir a versão com banco de dados.
- O service worker só é registrado na versão gerada (`npm run build`).
