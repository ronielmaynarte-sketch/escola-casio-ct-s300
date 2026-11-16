#!/usr/bin/env python3
"""Diretor de edição (Gemini). Uso:
python3 diretor.py --tema "..." | --roteiro arquivo.txt  [--formato 9:16|16:9] [--duracao 60] [--modo tema|explicacao|roteiro] -o plano.json
"""
import argparse, json, os, urllib.request, re, sys

MODELS = ["gemini-3-flash-preview", "gemini-flash-latest", "gemini-3.1-flash-lite"]
SYSTEM = """Você é um diretor de edição de vídeo com 20 anos de experiência em documentários, YouTube e Shorts virais.
Pense como diretor, não como montador. Retenção é tudo: gancho brutal nos 3 primeiros segundos, revelação progressiva,
uma ideia por cena, frases curtas e faladas (português do Brasil natural), números escritos por extenso na narração.
Cada cena terá 1 a 3 frases (4 a 10 segundos). Para cada cena escolha imagens que mostrem LITERALMENTE o que está sendo dito.
As buscas de mídia ("buscas") devem ser em INGLÊS, concretas e filmáveis (ex.: "roman soldiers marching", "old gold coins closeup"),
2 a 4 por cena, da mais específica para a mais genérica. Nada de termos abstratos.
Escolha a música pelo clima geral: epico, tenso, inspirador, calmo ou misterio.
Grade de cor (uma para o vídeo inteiro, identidade consistente): teal_orange, quente, frio, dramatico, pb ou neutro.
camera: push_in, pull_out, pan_left ou pan_right (varie; use push_in em revelações).
transicao (opcional, só quando motivada): fadeblack (virada dramática), smoothleft, smoothright, smoothup, zoomin, dissolve.
sfx (opcional): riser antes de uma revelação.
texto_tela: no máximo em 1 de cada 3 cenas — um número, data ou palavra de impacto bem curta (máx. 3 palavras).
destaques: 1 a 3 palavras-chave que aparecem na narração daquela cena.
Responda SOMENTE com JSON válido neste formato:
{"titulo":"...","descricao":"2 a 3 frases para a publicação","hashtags":["#..."],"musica":"epico","grade":"teal_orange",
"cenas":[{"narracao":"...","buscas":["..."],"destaques":["..."],"camera":"push_in","transicao":"","sfx":"","texto_tela":""}]}
A última cena fecha com uma frase forte e uma chamada curta para seguir o perfil."""

def gemini(prompt):
    import time
    last = None
    for tent in range(6):
        try: return _gemini(prompt, MODELS[tent % len(MODELS)])
        except Exception as e: last = e; print("gemini tentativa", tent + 1, e, file=sys.stderr); time.sleep(4)
    raise last

def _gemini(prompt, model):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    body = {"systemInstruction": {"parts": [{"text": SYSTEM}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.8, "responseMimeType": "application/json"}}
    h = {"Content-Type": "application/json"}
    if os.environ.get("GEMINI_API_KEY"): h["x-goog-api-key"] = os.environ["GEMINI_API_KEY"]
    req = urllib.request.Request(url, json.dumps(body).encode(), h)
    with urllib.request.urlopen(req, timeout=180) as r:
        d = json.loads(r.read())
    txt = "".join(p.get("text", "") for p in d["candidates"][0]["content"]["parts"] if not p.get("thought"))
    return json.loads(re.sub(r"^```json|```$", "", txt.strip()))

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--tema"); ap.add_argument("--roteiro"); ap.add_argument("--explicacao", default="")
    ap.add_argument("--formato", default="9:16"); ap.add_argument("--duracao", type=int, default=60)
    ap.add_argument("-o", default="plano.json")
    a = ap.parse_args()
    palavras = int(a.duracao * 2.6)
    if a.roteiro:
        texto = open(a.roteiro).read()
        p = (f"Siga ESTE ROTEIRO FIELMENTE, palavra por palavra, apenas dividindo em cenas e dirigindo a edição:\n{texto}")
    else:
        p = (f"Tema: {a.tema}\n{a.explicacao}\nEscreva o roteiro (cerca de {palavras} palavras, ~{a.duracao}s) e dirija a edição.")
    plano = gemini(p)
    plano["formato"] = a.formato
    json.dump(plano, open(a.o, "w"), ensure_ascii=False, indent=1)
    print(json.dumps(plano, ensure_ascii=False)[:600])
