#!/usr/bin/env python3
"""Gera src/content/songs/*.json (músicas em domínio público).
Notação: ver src/lib/musica/notacao.ts. Rode: python3 scripts/gerar-musicas.py"""
import json, os
OUT = os.path.join(os.path.dirname(__file__), '..', 'src', 'content', 'songs')
os.makedirs(OUT, exist_ok=True)
CONF = 'Melodia transcrita da partitura de domínio público e conferida nota a nota.'

def salvar(d):
    with open(os.path.join(OUT, d['id'] + '.json'), 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False, indent=2)

# ---------------- Für Elise ----------------
salvar({
  'id': 'fur-elise', 'titulo': 'Für Elise (Pour Elise) — parte A', 'compositor': 'Ludwig van Beethoven (WoO 59, c. 1810)',
  'categoria': 'classicas', 'compasso': [3, 8], 'bpm': 104, 'tonalidade': 'Lá menor',
  'descricao': 'Os 8 primeiros compassos (tema A). Batida = colcheia; semicolcheia = meia batida.',
  'licenca': 'Composta por volta de 1810 — domínio público.', 'fontes': [CONF],
  'observacoes': {'intermediario': 'Mão esquerda: só o baixo (Lá ou Mi) no início do compasso.', 'avancado': 'Mão esquerda com o arpejo original (Lá–Mi–Lá / Mi–Mi–Sol#).'},
  'secoes': [
    {'nome': 'Frase 1 (compassos 1–4)',
     'md': 'E5:0.5 D#5 | E5 D#5 E5 B4 D5 C5 | A4:1 R:0.5 C4:0.5 E4 A4 | B4:1 R:0.5 E4:0.5 G#4 B4 | C5:1 R:0.5 E4:0.5 E5 D#5',
     'harmonia': 'R:1 R:3 Am:3 E:3 Am:3',
     'meAvancado': 'R:1 R:3 A2:0.5 E3 A3 R:1.5 E2:0.5 E3 G#3 R:1.5 A2:0.5 E3 A3 R:1.5'},
    {'nome': 'Frase 2 (compassos 5–8)',
     'md': 'E5:0.5 D#5 E5 B4 D5 C5 | A4:1 R:0.5 C4:0.5 E4 A4 | B4:1 R:0.5 E4:0.5 C5 B4 | A4:3',
     'harmonia': 'R:3 Am:3 E:3 Am:3',
     'meAvancado': 'R:3 A2:0.5 E3 A3 R:1.5 E2:0.5 E3 G#3 R:1.5 A2:0.5 E3 A3 R:1.5'},
  ]})

# ---------------- Canon ----------------
baixo_canon = 'D3:1 A2 B2 F#2 G2 D2 G2 A2'
av_canon = '[D3 A3]:1 [A2 E3] [B2 F#3] [F#2 C#3] [G2 D3] [D2 A2] [G2 D3] [A2 E3]'
h_canon = 'D:1 A:1 Bm:1 F#m:1 G:1 D:1 G:1 A:1'
salvar({
  'id': 'canon-pachelbel', 'titulo': 'Cânone em Ré (simplificado)', 'compositor': 'Johann Pachelbel (c. 1680)',
  'categoria': 'classicas', 'compasso': [4, 4], 'bpm': 60, 'tonalidade': 'Ré maior',
  'descricao': 'O baixo famoso (Ré–Lá–Si–Fá#–Sol–Ré–Sol–Lá) com os dois primeiros temas e a variação em colcheias.',
  'licenca': 'Composto no século XVII — domínio público.', 'fontes': [CONF],
  'observacoes': {'intermediario': 'Mão esquerda: o baixo original, uma nota por tempo.', 'avancado': 'Mão esquerda: baixo + quinta (simplificação do contínuo).'},
  'secoes': [
    {'nome': 'Tema 1', 'md': 'F#5:1 E5 D5 C#5 B4 A4 B4 C#5', 'harmonia': h_canon, 'meIntermediario': baixo_canon, 'meAvancado': av_canon},
    {'nome': 'Tema 2', 'md': 'D5:1 C#5 B4 A4 G4 F#4 G4 E4', 'harmonia': h_canon, 'meIntermediario': baixo_canon, 'meAvancado': av_canon},
    {'nome': 'Variação em colcheias', 'md': 'D5:0.5 F#5 A5 G5 F#5 D5 F#5 E5 D5 B4 D5 A5 G5 B5 A5 G5', 'harmonia': h_canon, 'meIntermediario': baixo_canon, 'meAvancado': av_canon},
  ]})

# ---------------- Sonata ao Luar ----------------
t = lambda a, b, c: f'{a} {b} {c}'
c12 = ' '.join([t('G#3', 'C#4', 'E4')] * 4)
salvar({
  'id': 'sonata-ao-luar', 'titulo': 'Sonata ao Luar — 1º mov. (abertura)', 'compositor': 'Ludwig van Beethoven (Sonata op. 27 nº 2, 1801)',
  'categoria': 'classicas', 'compasso': [4, 4], 'bpm': 52, 'tonalidade': 'Dó# menor', 'divisao': 54,
  'descricao': 'Compassos 1–4: as tercinas da mão direita sobre o baixo. Escrito em 4/4 (o original é alla breve); cada tercina = 1/3 de batida.',
  'licenca': 'Publicada em 1802 — domínio público.', 'fontes': [CONF],
  'observacoes': {'avancado': 'As oitavas graves do original (Si1, Lá1, Fá#1, Sol#1) ficam abaixo do Dó2 do CT-S300; tocamos só a nota de cima. O Si# do compasso 4 aparece como Dó (é a mesma tecla).'},
  'secoes': [
    {'nome': 'Compassos 1–2', 'md': 'G#3:1/3 C#4 E4 ' + ' '.join([t('G#3', 'C#4', 'E4')] * 3) + ' | ' + c12,
     'meIntermediario': 'C#3:4 B2:4', 'meAvancado': '[C#2 C#3]:4 B2:4'},
    {'nome': 'Compassos 3–4', 'md': 'A3:1/3 C#4 E4 A3 C#4 E4 A3 D4 F#4 A3 D4 F#4 | G#3 C4 F#4 G#3 C#4 E4 G#3 C#4 D#4 F#3 C4 D#4',
     'meIntermediario': 'A2:4 G#2:4', 'meAvancado': 'A2:2 F#2:2 G#2:4'},
  ]})

# ---------------- Ode à Alegria ----------------
f1 = 'E4:1 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4'
salvar({
  'id': 'ode-alegria', 'titulo': 'Ode à Alegria', 'compositor': 'Ludwig van Beethoven (9ª Sinfonia, 1824)',
  'categoria': 'classicas', 'compasso': [4, 4], 'bpm': 100, 'tonalidade': 'Dó maior',
  'descricao': 'O tema completo, em Dó maior. Ótima para começar: a mão direita quase não sai do lugar.',
  'licenca': 'Composta em 1824 — domínio público.', 'fontes': [CONF],
  'secoes': [
    {'nome': 'Frase 1', 'md': f1 + ' | E4:1.5 D4:0.5 D4:2', 'harmonia': 'C G C G'},
    {'nome': 'Frase 2', 'md': f1 + ' | D4:1.5 C4:0.5 C4:2', 'harmonia': 'C G C G:2 C:2'},
    {'nome': 'Frase 3 (meio)', 'md': 'D4:1 D4 E4 C4 | D4 E4:0.5 F4 E4:1 C4 | D4 E4:0.5 F4 E4:1 D4 | C4 D4 G3:2', 'harmonia': 'G G:2 C:2 G C:2 G:2'},
    {'nome': 'Frase 4', 'md': f1 + ' | D4:1.5 C4:0.5 C4:2', 'harmonia': 'C G C G:2 C:2'},
  ]})

# ---------------- Minueto em Sol ----------------
m1 = 'D5:1 G4:0.5 A4 B4 C5 | D5:1 G4 G4 | E5:1 C5:0.5 D5 E5 F#5 | G5:1 G4 G4'
salvar({
  'id': 'minueto-sol', 'titulo': 'Minueto em Sol', 'compositor': 'Christian Petzold (BWV Anh. 114, do Caderno de Anna Magdalena Bach, 1725)',
  'categoria': 'classicas', 'compasso': [3, 4], 'bpm': 100, 'tonalidade': 'Sol maior',
  'descricao': 'A primeira parte do minueto (16 compassos).',
  'licenca': 'Composto por volta de 1725 — domínio público.', 'fontes': [CONF],
  'observacoes': {'intermediario': 'A mão esquerda é um baixo simplificado (não é a linha original).', 'avancado': 'Acompanhamento simplificado em baixo + acorde (não é a mão esquerda original).'},
  'secoes': [
    {'nome': 'Frase 1 (compassos 1–4)', 'md': m1, 'harmonia': 'G G C G'},
    {'nome': 'Frase 2 (compassos 5–8)', 'md': 'C5:1 D5:0.5 C5 B4 A4 | B4:1 C5:0.5 B4 A4 G4 | F#4:1 G4:0.5 A4 B4 G4 | A4:3', 'harmonia': 'C G D7 D'},
    {'nome': 'Frase 3 (compassos 9–12)', 'md': m1, 'harmonia': 'G G C G'},
    {'nome': 'Frase 4 (compassos 13–16)', 'md': 'C5:1 D5:0.5 C5 B4 A4 | B4:1 C5:0.5 B4 A4 G4 | A4:1 B4:0.5 A4 G4 F#4 | G4:3', 'harmonia': 'C G D7 G'},
  ]})

# ---------------- Greensleeves ----------------
salvar({
  'id': 'greensleeves', 'titulo': 'Greensleeves', 'compositor': 'Tradicional inglesa (século XVI)',
  'categoria': 'classicas', 'compasso': [3, 4], 'bpm': 96, 'tonalidade': 'Lá menor',
  'descricao': 'Estrofe e refrão da melodia tradicional.',
  'licenca': 'Melodia tradicional do século XVI — domínio público.', 'fontes': [CONF],
  'secoes': [
    {'nome': 'Estrofe — parte 1', 'md': 'A4:1 | C5:2 D5:1 | E5:1.5 F5:0.5 E5:1 | D5:2 B4:1 | G4:1.5 A4:0.5 B4:1 | C5:2 A4:1 | A4:1.5 G#4:0.5 A4:1 | B4:2 G#4:1 | E4:2',
     'harmonia': 'R:1 Am:3 C:3 G:3 Em:3 F:3 E:3 E:3 E:2'},
    {'nome': 'Estrofe — parte 2', 'md': 'A4:1 | C5:2 D5:1 | E5:1.5 F5:0.5 E5:1 | D5:2 B4:1 | G4:1.5 A4:0.5 B4:1 | C5:1.5 B4:0.5 A4:1 | G#4:1.5 F#4:0.5 G#4:1 | A4:3',
     'harmonia': 'R:1 Am:3 C:3 G:3 Em:3 Am:3 E:3 Am:3'},
    {'nome': 'Refrão — parte 1', 'md': 'G5:3 | G5:1.5 F#5:0.5 E5:1 | D5:2 B4:1 | G4:1.5 A4:0.5 B4:1 | C5:2 A4:1 | A4:1.5 G#4:0.5 A4:1 | B4:2 G#4:1 | E4:3',
     'harmonia': 'C:3 G:3 G:3 Em:3 Am:3 E:3 E:3 E:3'},
    {'nome': 'Refrão — parte 2', 'md': 'G5:3 | G5:1.5 F#5:0.5 E5:1 | D5:2 B4:1 | G4:1.5 A4:0.5 B4:1 | C5:1.5 B4:0.5 A4:1 | G#4:1.5 F#4:0.5 G#4:1 | A4:3',
     'harmonia': 'C:3 G:3 G:3 Em:3 Am:3 E:3 Am:3'},
  ]})

# ---------------- Brilha Brilha Estrelinha ----------------
b1 = 'C4:1 C4 G4 G4 | A4 A4 G4:2 | F4:1 F4 E4 E4 | D4 D4 C4:2'
hb1 = 'C F:2 C:2 F:2 C:2 G:2 C:2'
salvar({
  'id': 'brilha-estrelinha', 'titulo': 'Brilha, Brilha, Estrelinha', 'compositor': 'Melodia tradicional francesa ("Ah! vous dirai-je, maman", século XVIII)',
  'categoria': 'infantis', 'compasso': [4, 4], 'bpm': 96, 'tonalidade': 'Dó maior',
  'descricao': 'A primeira música de quase todo pianista.',
  'licenca': 'Melodia tradicional do século XVIII — domínio público.', 'fontes': [CONF],
  'secoes': [
    {'nome': 'Frase 1', 'md': b1, 'harmonia': hb1},
    {'nome': 'Frase 2', 'md': 'G4:1 G4 F4 F4 | E4 E4 D4:2 | G4:1 G4 F4 F4 | E4 E4 D4:2', 'harmonia': 'C:2 G:2 C:2 G:2 C:2 G:2 C:2 G:2'},
    {'nome': 'Frase 3', 'md': b1, 'harmonia': hb1},
  ]})

# ---------------- Prelúdio em Dó BWV 846 ----------------
compassos = [
  ('C4', 'E4', 'G4', 'C5', 'E5'), ('C4', 'D4', 'A4', 'D5', 'F5'), ('B3', 'D4', 'G4', 'D5', 'F5'), ('C4', 'E4', 'G4', 'C5', 'E5'),
  ('C4', 'E4', 'A4', 'E5', 'A5'), ('C4', 'D4', 'F#4', 'A4', 'D5'), ('B3', 'D4', 'G4', 'D5', 'G5'), ('B3', 'C4', 'E4', 'G4', 'C5'),
  ('A3', 'C4', 'E4', 'G4', 'C5'), ('D3', 'A3', 'D4', 'F#4', 'C5'), ('G3', 'B3', 'D4', 'G4', 'B4'),
]
def pre_md(c):
    n1, n2, n3, n4, n5 = c
    meia = f'R:0.5 {n3}:0.25 {n4} {n5} {n3} {n4} {n5}'
    return meia + ' ' + meia
def pre_me(c):
    return f'{c[0]}:0.25 {c[1]}:1.75 {c[0]}:0.25 {c[1]}:1.75'
grupos = [(0, 4, 'Compassos 1–4'), (4, 8, 'Compassos 5–8'), (8, 11, 'Compassos 9–11')]
salvar({
  'id': 'preludio-bwv846', 'titulo': 'Prelúdio em Dó (abertura)', 'compositor': 'Johann Sebastian Bach (BWV 846, O Cravo Bem Temperado, 1722)',
  'categoria': 'classicas', 'compasso': [4, 4], 'bpm': 66, 'tonalidade': 'Dó maior', 'divisao': 62,
  'descricao': 'Compassos 1–11. Cada meio compasso é o mesmo desenho de arpejo; batida = semínima, semicolcheia = 1/4.',
  'licenca': 'Composto em 1722 — domínio público.', 'fontes': [CONF],
  'observacoes': {'facil': 'Só o desenho da mão direita (3 notas que se repetem).', 'intermediario': 'Mão esquerda: só a nota grave, uma vez por compasso.', 'avancado': 'As duas notas da mão esquerda como no original.'},
  'secoes': [
    {'nome': nome, 'md': ' | '.join(pre_md(c) for c in compassos[a:b]),
     'meIntermediario': ' '.join(f'{c[0]}:4' for c in compassos[a:b]),
     'meAvancado': ' | '.join(pre_me(c) for c in compassos[a:b])}
    for a, b, nome in grupos
  ]})

# ---------------- Marcha Turca ----------------
salvar({
  'id': 'marcha-turca', 'titulo': 'Marcha Turca (abertura)', 'compositor': 'Wolfgang Amadeus Mozart (Rondo alla Turca, Sonata K. 331, 1783)',
  'categoria': 'classicas', 'compasso': [2, 4], 'bpm': 96, 'tonalidade': 'Lá menor', 'divisao': 65,
  'descricao': 'Anacruse e compassos 1–8, sem os ornamentos e sem as terças internas da mão direita. Andamento original ≈126; aqui começa mais devagar.',
  'licenca': 'Publicada em 1784 — domínio público.',
  'fontes': ['Melodia conferida com a transcrição da Mutopia (domínio público) citada em musictheoryprint.com/charts/turkish-march-piano-notes e com notenames.app.'],
  'observacoes': {'avancado': 'Compassos 1–4 com a mão esquerda do original (Lá + terça Dó–Mi); compassos 5–8 com acompanhamento simplificado.'},
  'secoes': [
    {'nome': 'Abertura (compassos 1–4)', 'md': 'B4:0.25 A4 G#4 A4 | C5:1 D5:0.25 C5 B4 C5 | E5:1 F5:0.25 E5 D#5 E5 | B5:0.25 A5 G#5 A5 B5 A5 G#5 A5 | C6:1 A5:0.5 C6',
     'harmonia': 'R:1 Am:2 Am:2 Am:2 Am:2',
     'meAvancado': 'R:1 A3:0.5 [C4 E4] [C4 E4] [C4 E4] | A3 [C4 E4] [C4 E4] [C4 E4] | A3 [C4 E4] A3 [C4 E4] | A3 [C4 E4] [C4 E4] [C4 E4]'},
    {'nome': 'Compassos 5–8', 'md': 'B5:0.5 A5 G5 A5 | B5 A5 G5 A5 | B5 A5 G5 F#5 | E5:2', 'harmonia': 'Em:2 Em:2 B7:2 Em:2'},
  ]})

# ---------------- Jingle Bells ----------------
jb = 'E4:1 E4 E4:2 | E4:1 E4 E4:2 | E4:1 G4 C4:1.5 D4:0.5 | E4:4'
salvar({
  'id': 'jingle-bells', 'titulo': 'Jingle Bells (refrão)', 'compositor': 'James Lord Pierpont (1857)',
  'categoria': 'natal', 'compasso': [4, 4], 'bpm': 112, 'tonalidade': 'Dó maior',
  'descricao': 'O refrão famoso, em Dó maior.',
  'licenca': 'Publicada em 1857 — domínio público.', 'fontes': [CONF],
  'secoes': [
    {'nome': 'Refrão — parte 1', 'md': jb, 'harmonia': 'C C C C'},
    {'nome': 'Refrão — parte 2', 'md': 'F4:1 F4 F4 F4 | F4 E4 E4 E4:0.5 E4 | E4:1 D4 D4 E4 | D4:2 G4:2', 'harmonia': 'F C D7 G7'},
    {'nome': 'Refrão — parte 3', 'md': jb, 'harmonia': 'C C C C'},
    {'nome': 'Refrão — final', 'md': 'F4:1 F4 F4 F4 | F4 E4 E4 E4:0.5 E4 | G4:1 G4 F4 D4 | C4:4', 'harmonia': 'F C G7 C'},
  ]})

# ---------------- Ciranda Cirandinha ----------------
salvar({
  'id': 'ciranda-cirandinha', 'titulo': 'Ciranda, Cirandinha', 'compositor': 'Folclore brasileiro',
  'categoria': 'infantis', 'compasso': [2, 4], 'bpm': 100, 'tonalidade': 'Sol maior', 'ritmoAproximado': True,
  'descricao': 'Cantiga de roda tradicional. As notas foram conferidas; o ritmo é aproximado (o professor confere as notas).',
  'licenca': 'Cantiga folclórica, sem autor conhecido — domínio público.',
  'fontes': ['Notas conferidas com potatoflute.com/pt/packs/brazil/ciranda e inesmcgutti.jimdofree.com/kids/ciranda-cirandinha (mesma sequência, transposta).'],
  'secoes': [
    {'nome': 'Ciranda, cirandinha', 'md': 'D4:0.5 G4 G4 B4 B4 D5 D5:1', 'harmonia': 'G:4'},
    {'nome': 'Vamos todos cirandar', 'md': 'C5:0.5 B4 A4 D5 B4 A4 G4:1', 'harmonia': 'D7:3 G:1'},
    {'nome': 'Vamos dar a meia volta', 'md': 'B4:0.5 D5 C5 B4 A4 G4 F#4 D4:1', 'harmonia': 'G:2.5 D7:2'},
    {'nome': 'Volta e meia vamos dar', 'md': 'C5:0.5 A4 B4 G4 A4 F#4 G4:1', 'harmonia': 'D7:3 G:1'},
  ]})

# ---------------- Atirei o Pau no Gato ----------------
salvar({
  'id': 'atirei-o-pau-no-gato', 'titulo': 'Atirei o Pau no Gato', 'compositor': 'Folclore brasileiro',
  'categoria': 'infantis', 'compasso': [2, 4], 'bpm': 100, 'tonalidade': 'Dó maior', 'ritmoAproximado': True,
  'descricao': 'Cantiga tradicional (também cantada como "Não atire o pau no gato"). Notas conferidas; ritmo aproximado.',
  'licenca': 'Cantiga folclórica, sem autor conhecido — domínio público.',
  'fontes': ['Notas conferidas com sotecladosolos.blogspot.com (Atirei o Pau no Gato "Notas Musicais") e aulaviolaodeboa.com (cifra e solo), que concordam nota a nota.'],
  'secoes': [
    {'nome': 'Atirei o pau no gato', 'md': 'G4:0.5 F4 E4 D4 E4 F4 G4 G4 G4:1', 'harmonia': 'C:5'},
    {'nome': 'Mas o gato não morreu', 'md': 'A4:0.5 G4 F4 F4 F4:1 | G4:0.5 F4 E4 E4 E4:1', 'harmonia': 'G7:3 C:3'},
    {'nome': 'Dona Chica admirou-se', 'md': 'C4:0.5 C4 A4 A4 A4:1 | B4:0.5 A4 G4 G4 G4:1', 'harmonia': 'F:3 G:3'},
    {'nome': 'Do berro que o gato deu — miau!', 'md': 'E4:0.5 F4 G4:1 E4:0.5 F4 G4:1 | F4:0.5 E4 D4 C4:1 | C5:1 C5:1', 'harmonia': 'C:4 G7:1.5 C:1 C:2'},
  ]})

# ---------------- Marcha Nupcial (Wagner) ----------------
w1 = 'G4:1 C5:0.75 C5:0.25 | C5:2 | G4:1 D5:0.75 B4:0.25 | C5:2'
salvar({
  'id': 'marcha-nupcial-wagner', 'titulo': 'Marcha Nupcial ("Lá vem a noiva")', 'compositor': 'Richard Wagner (Coro Nupcial de Lohengrin, 1850)',
  'categoria': 'festas', 'compasso': [2, 4], 'bpm': 72, 'tonalidade': 'Dó maior (original em Si bemol)',
  'descricao': 'Os 16 primeiros compassos da melodia, transpostos para Dó maior.',
  'licenca': 'Composta em 1850 — domínio público.',
  'fontes': ['Melodia conferida com vivace-music.org (Bridal Chorus, letras das notas) e easypianoletters.com/sheets/bridal-chorus; ritmo pontuado do original (piano.org/songs/bridal-chorus).'],
  'secoes': [
    {'nome': 'Frase 1', 'md': w1, 'harmonia': 'C C G C'},
    {'nome': 'Frase 2', 'md': 'G4:1 C5:0.75 F5:0.25 | F5:1 E5:0.75 D5:0.25 | C5:1 B4:0.75 C5:0.25 | D5:2', 'harmonia': 'C:1 F:1 F C G'},
    {'nome': 'Frase 3', 'md': w1, 'harmonia': 'C C G C'},
    {'nome': 'Frase 4', 'md': 'G4:1 C5:0.75 E5:0.25 | G5:1 E5:0.75 C5:0.25 | A4:1 D5:0.75 E5:0.25 | C5:2', 'harmonia': 'C C F:1 G:1 C'},
  ]})
print('ok', len(os.listdir(OUT)))
