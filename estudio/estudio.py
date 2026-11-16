#!/usr/bin/env python3
"""Estúdio de Vídeos do Roniel — motor de edição automática.
Uso: python3 estudio.py plano.json saida_dir
As chaves de API nunca ficam no código: são injetadas pelo cofre do Hark
(placeholder __SAVED_KEY__ no Pixabay; cabeçalho automático no Freesound/ElevenLabs/Gemini).
"""
import json, os, sys, re, math, random, subprocess, asyncio, urllib.parse, urllib.request, hashlib, shutil, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "fonts")
FPS = 30
UA = {"User-Agent": "EstudioRoniel/1.0"}

def log(*a): print("[estudio]", *a, flush=True)

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        print(r.stderr[-2500:]); raise RuntimeError("ffmpeg falhou")
    return r

def dur(f):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).strip())

def _auth(url, headers):
    """Fora do Hark (GitHub Actions/PC): chaves vêm de variáveis de ambiente. No Hark, o proxy injeta."""
    h = dict(headers or {})
    E = os.environ.get
    if "__SAVED_KEY__" in url and E("PIXABAY_API_KEY"): url = url.replace("__SAVED_KEY__", E("PIXABAY_API_KEY"))
    if "freesound.org" in url and E("FREESOUND_API_KEY"): h.setdefault("Authorization", "Token " + E("FREESOUND_API_KEY"))
    if "generativelanguage.googleapis.com" in url and E("GEMINI_API_KEY"): h.setdefault("x-goog-api-key", E("GEMINI_API_KEY"))
    if "api.elevenlabs.io" in url and E("ELEVENLABS_API_KEY") and "xi-api-key" not in h: h["xi-api-key"] = E("ELEVENLABS_API_KEY")
    return url, h

def get_json(url, headers=None, data=None, method=None, timeout=120):
    url, headers = _auth(url, headers)
    req = urllib.request.Request(url, data=data, headers={**UA, **(headers or {})}, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())

def download(url, path):
    minb = 50000 if path.endswith(".mp4") else 3000
    if os.path.exists(path) and os.path.getsize(path) > minb: return path
    ua = "EstudioVideos/1.0 (ronielmaynarte@gmail.com)" if "wikimedia" in url else "Mozilla/5.0"
    subprocess.run(["curl", "-sL", "-A", ua, "--max-time", "120", "-o", path, url])
    ok = os.path.exists(path) and os.path.getsize(path) > minb
    if ok and not path.endswith((".mp3", ".wav")):
        ok = subprocess.run(["ffprobe", "-v", "error", path], capture_output=True).returncode == 0
    if not ok:
        if os.path.exists(path): os.remove(path)
        raise IOError("download inválido: " + url[:80])
    return path

# ---------------------------------------------------------------- narração
def chaves(servico):
    """Chaves trocáveis: chaves.json {"elevenlabs": ["k1","k2"], "gemini": [...], ...} ou variável
    de ambiente ELEVENLABS_API_KEYS="k1,k2". Lista vazia = usa a chave conectada no ambiente (proxy)."""
    lst = []
    cfg = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chaves.json")
    if os.path.exists(cfg):
        try: lst = [k for k in json.load(open(cfg)).get(servico, []) if k]
        except Exception as e: log("chaves.json inválido:", e)
    env = os.environ.get(servico.upper() + "_API_KEYS", "")
    lst += [k.strip() for k in env.split(",") if k.strip()]
    return lst or [None]

def tts_eleven(text, out_mp3, voice_id):
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_128"
    body = json.dumps({"text": text, "model_id": "eleven_multilingual_v2",
                       "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.35, "use_speaker_boost": True}}).encode()
    d, err = None, None
    for k in chaves("elevenlabs"):  # troca automática quando uma chave acaba o saldo ou é recusada
        try:
            h = {"Content-Type": "application/json", **({"xi-api-key": k} if k else {})}
            d = get_json(url, h, body, "POST"); break
        except Exception as e:
            err = e; log("ElevenLabs: chave recusada/sem saldo, tentando a próxima:", e)
    if d is None: raise err
    import base64
    open(out_mp3, "wb").write(base64.b64decode(d["audio_base64"]))
    al = d["alignment"]; words = []; cur = ""; st = None
    for ch, s, e in zip(al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]):
        if ch.isspace():
            if cur: words.append([st, last_e, cur]); cur = ""
            continue
        if not cur: st = s
        cur += ch; last_e = e
    if cur: words.append([st, last_e, cur])
    return words

def tts_edge(text, out_mp3, voice="pt-BR-AntonioNeural"):
    import edge_tts
    saved = {k: os.environ.pop(k) for k in list(os.environ) if k.lower() in ("http_proxy", "https_proxy")}
    async def go():
        c = edge_tts.Communicate(text, voice, rate="+6%", boundary="WordBoundary")
        words = []
        with open(out_mp3, "wb") as f:
            async for ch in c.stream():
                if ch["type"] == "audio": f.write(ch["data"])
                elif ch["type"] == "WordBoundary":
                    words.append([ch["offset"] / 1e7, (ch["offset"] + ch["duration"]) / 1e7, ch["text"]])
        return words
    try:
        return asyncio.run(go())
    finally:
        os.environ.update(saved)

# ---------------------------------------------------------------- mídia
def pixabay_videos(q, vertical):
    if os.environ.get("PIXABAY_VIDEOS", "0") != "1": return []  # CDN bloqueado no sandbox; ligar onde o download funcionar
    try:
        d = get_json("https://pixabay.com/api/videos/?key=__SAVED_KEY__&video_type=film&safesearch=true&per_page=12&q=" + urllib.parse.quote(q))
    except Exception as e:
        log("pixabay vídeos falhou:", e); return []
    out = []
    for h in d.get("hits", []):
        v = h["videos"].get("large") or h["videos"].get("medium")
        if not v or not v.get("url") or v.get("width", 0) < 1280: continue
        out.append({"src": "pixabay", "kind": "video", "url": v["url"], "id": f"pxb{h['id']}", "dur": h.get("duration", 8),
                    "credit": f"Pixabay — {h.get('user','')} ({h.get('pageURL','')})", "vertical": v["height"] > v["width"]})
    return out

def pixabay_photos(q, vertical):
    """Fotos: Wikimedia Commons (livre, ótimo para história). O conector do Pixabay está ligado à rota de vídeos."""
    try:
        d = get_json("https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=10"
                     "&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1920&gsrsearch=" + urllib.parse.quote(q + " filetype:bitmap"))
    except Exception as e:
        log("commons falhou:", e); return []
    out = []
    for p in (d.get("query", {}).get("pages", {}) or {}).values():
        ii = (p.get("imageinfo") or [{}])[0]
        if ii.get("width", 0) < 1200: continue
        lic = ii.get("extmetadata", {}).get("LicenseShortName", {}).get("value", "")
        art = re.sub("<[^>]+>", "", ii.get("extmetadata", {}).get("Artist", {}).get("value", ""))[:60]
        out.append({"src": "commons", "kind": "photo", "url": ii.get("thumburl") or ii["url"], "id": f"wm{p['pageid']}",
                    "credit": f"Wikimedia Commons — {p['title']} ({art}, {lic})",
                    "thumb": ii.get("thumburl") or ""})
    return out

def coverr_videos(q, vertical):
    try:
        d = get_json("https://coverr.co/api/videos?page_size=12&query=" + urllib.parse.quote(q))
    except Exception as e:
        log("coverr falhou:", e); return []
    out = []
    for h in d.get("hits", []):
        if h.get("is_premium") or h.get("is_ai_generated"): continue
        hay = (h.get("title", "") + " " + " ".join(h.get("tags", []))).lower()
        out.append({"src": "coverr", "kind": "video", "id": "cvr" + h["id"], "dur": float(h.get("duration") or 8),
                    "url": f"https://cdn.coverr.co/videos/{h['base_filename']}/1080p.mp4",
                    "credit": f"Coverr — {h.get('title','')}", "vertical": bool(h.get("is_vertical")),
                    "thumb": h.get("thumbnail", ""), "desc": h.get("title", "")})
    return out

def _thumb_b64(url):
    import base64, tempfile
    if not url: return None
    try:
        ua = "EstudioVideos/1.0 (ronielmaynarte@gmail.com)"
        with tempfile.TemporaryDirectory() as td:
            src, dst = os.path.join(td, "in"), os.path.join(td, "out.jpg")
            subprocess.run(["curl", "-sL", "-A", ua, "--max-time", "25", "-o", src, url])
            if not os.path.exists(src) or os.path.getsize(src) < 2000: return None
            r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", "scale=512:-2", "-frames:v", "1", "-q:v", "4", dst])
            if r.returncode or not os.path.exists(dst): return None
            return base64.b64encode(open(dst, "rb").read()).decode()
    except Exception: return None

def judge(cands, scene_text, queries):
    """Gemini olha as miniaturas e escolhe a que melhor ilustra a cena. Retorna índice ou -1."""
    parts = [{"text": "Você é editor de vídeo. Narração da cena (pt-BR): \"" + scene_text + "\". Buscas: " + ", ".join(queries) +
              ". Abaixo há imagens numeradas. Escolha a que MELHOR ilustra a narração com impacto visual, coerente com o tema e a época. "
              "Rejeite coisas modernas fora de contexto, textos/jornais, diagramas, retratos aleatórios. "
              "Responda só JSON: {\"melhor\": n, \"nota\": 0-10} (n=-1 se nenhuma serve)."}]
    idx = []
    for i, c in enumerate(cands):
        b = _thumb_b64(c.get("thumb", ""))
        if not b: continue
        parts += [{"text": f"#{i}"}, {"inline_data": {"mime_type": "image/jpeg", "data": b}}]; idx.append(i)
    if not idx: return 0
    body = json.dumps({"contents": [{"parts": parts}], "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2, "thinkingConfig": {"thinkingLevel": "low"}}}).encode()
    import time
    for tent, model in enumerate(("gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-3.5-flash-lite",
                                  "gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-3.1-flash-lite")):
        if tent: time.sleep(min(30, 6 * tent))
        try:
            d = get_json(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                         headers={"Content-Type": "application/json"}, data=body, method="POST")
            txt = "".join(p.get("text", "") for p in d["candidates"][0]["content"]["parts"] if not p.get("thought"))
            j = json.loads(txt[txt.index("{"):txt.rindex("}") + 1])
            n, nota = int(j.get("melhor", -1)), float(j.get("nota", 0))
            log(f"juiz: #{n} nota {nota} — {cands[n]['credit'][:60] if 0 <= n < len(cands) else 'nenhuma'}")
            return n if (0 <= n < len(cands) and nota >= 5) else -1
        except Exception as e:
            log("juiz falhou:", model, e)
    return -2  # juiz indisponível

def find_media(queries, vertical, used, cache, scene_text=""):
    """Junta candidatos (vídeo primeiro, depois foto) e deixa o Gemini escolher pela imagem."""
    vids, fotos = [], []
    for q in queries:
        for fn in (pixabay_videos, coverr_videos):
            key = (fn.__name__, q)
            if key not in cache: cache[key] = fn(q, vertical)
            vids += [c for c in cache[key][:5] if c["id"] not in used and c not in vids]
        key = ("photo", q)
        if key not in cache: cache[key] = pixabay_photos(q, vertical)
        fotos += [c for c in cache[key][:4] if c["id"] not in used and c not in fotos]
    cands = (vids[:8] + fotos[:6])
    if not cands: return None
    if not scene_text or os.environ.get("JUIZ", "1") != "1": return cands[0]
    jk = ("judge", tuple(queries), tuple(sorted(used)))
    n = judge(cands, scene_text, queries)
    if n >= 0:
        APROVADAS.append(cands[n]); return cands[n]
    return None

APROVADAS = []

# ---------------------------------------------------------------- som
def freesound(q, maxdur, mindur=0.2):
    try:
        flt = urllib.parse.quote(f'license:"Creative Commons 0" duration:[{mindur} TO {maxdur}]')
        d = get_json(f"https://freesound.org/apiv2/search/text/?query={urllib.parse.quote(q)}&filter={flt}"
                     "&sort=rating_desc&fields=id,name,username,previews,duration&page_size=8")
        return d.get("results", [])
    except Exception as e:
        log("freesound falhou:", e); return []

SR = 44100
def wav_write(path, x):
    x = np.clip(x, -1, 1)
    if x.ndim == 1: x = np.stack([x, x], 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())

def synth_sfx(kind, path):
    t = np.linspace(0, 1, SR, False)
    rng = np.random.default_rng(7)
    if kind == "whoosh":
        n = int(SR * 0.7); t = np.arange(n) / SR; noise = rng.standard_normal(n)
        env = np.sin(np.pi * t / t[-1]) ** 2
        f = np.cumsum(noise); f -= np.convolve(f, np.ones(400) / 400, "same")
        x = f / np.abs(f).max() * env * 0.6
    elif kind == "impact":
        n = int(SR * 1.6); t = np.arange(n) / SR
        x = np.sin(2 * np.pi * (55 * t + 30 * np.exp(-t * 8))) * np.exp(-t * 3) * 0.9
        x += rng.standard_normal(n) * np.exp(-t * 25) * 0.3
    elif kind == "riser":
        n = int(SR * 2.0); t = np.arange(n) / SR
        x = np.sin(2 * np.pi * (200 * t + 300 * t ** 2)) * (t / t[-1]) ** 2 * 0.3 + rng.standard_normal(n) * (t / t[-1]) ** 3 * 0.15
    else:  # pop
        n = int(SR * 0.15); t = np.arange(n) / SR
        x = np.sin(2 * np.pi * 900 * t) * np.exp(-t * 40) * 0.5
    wav_write(path, x)

def get_sfx(kind, work, credits):
    path = os.path.join(work, f"sfx_{kind}.mp3")
    if os.path.exists(path): return path
    q = {"whoosh": "whoosh transition", "impact": "cinematic impact boom", "riser": "cinematic riser", "pop": "pop click ui"}[kind]
    mx = {"whoosh": 1.5, "impact": 4, "riser": 4, "pop": 0.6}[kind]
    res = freesound(q, mx)
    if res:
        r = res[0]; download(r["previews"]["preview-hq-mp3"], path)
        credits.append(f"Freesound — \"{r['name']}\" por {r['username']} (CC0)")
        return path
    w = path.replace(".mp3", ".wav"); synth_sfx(kind, w); return w

def get_music(mood, total, work, credits):
    q = {"epico": "epic cinematic orchestral", "tenso": "dark tension cinematic", "inspirador": "inspiring cinematic piano",
         "calmo": "ambient calm piano", "misterio": "mystery suspense ambient"}.get(mood, "cinematic background music")
    res = freesound(q + " music loop", 240, mindur=max(30, min(total, 120)))
    if res:
        r = res[0]; p = os.path.join(work, "musica.mp3"); download(r["previews"]["preview-hq-mp3"], p)
        credits.append(f"Freesound — trilha \"{r['name']}\" por {r['username']} (CC0)")
        return p
    # trilha original sintetizada (pad + pulso)
    n = int(SR * (total + 2)); t = np.arange(n) / SR
    chords = [[110, 130.8, 164.8], [87.3, 110, 130.8], [98, 123.5, 146.8], [82.4, 98, 123.5]]
    x = np.zeros(n)
    for i in range(0, n, SR * 4):
        seg = slice(i, min(n, i + SR * 4)); tt = t[seg] - t[i]
        for f in chords[(i // (SR * 4)) % 4]:
            x[seg] += np.sin(2 * np.pi * f * tt) * 0.08 + np.sin(2 * np.pi * f * 2 * tt) * 0.03
        x[seg] *= np.minimum(1, tt / 0.8) * np.minimum(1, (4 - tt) / 0.8)
    x += np.sin(2 * np.pi * 55 * t) * (np.exp(-(t % 1.0) * 6)) * 0.12
    p = os.path.join(work, "musica.wav"); wav_write(p, x * 0.9); return p

# ---------------------------------------------------------------- imagem
GRADES = {
    "teal_orange": "colorbalance=rs=-0.06:bs=0.08:rh=0.08:bh=-0.06,eq=contrast=1.12:saturation=1.08",
    "quente": "colorbalance=rs=0.05:gs=0.01:bs=-0.05:rh=0.06:bh=-0.05,eq=contrast=1.08:saturation=1.05",
    "frio": "colorbalance=rs=-0.05:bs=0.08:rh=-0.03:bh=0.05,eq=contrast=1.1:saturation=0.92",
    "dramatico": "eq=contrast=1.22:saturation=0.85:brightness=-0.04,colorbalance=bs=0.05:bh=-0.03",
    "pb": "hue=s=0,eq=contrast=1.25",
    "neutro": "eq=contrast=1.06:saturation=1.02",
}

def render_shot(media, path_in, out, W, H, D, cam, grade, idx, punch=False):
    """Um plano: corte no ponto certo, câmera virtual, grade, vinheta e grão."""
    z0, z1 = {"push_in": (1.0, 1.12), "pull_out": (1.12, 1.0), "pan_left": (1.1, 1.1), "pan_right": (1.1, 1.1)}.get(cam, (1.0, 1.08))
    if punch: z0, z1 = 1.25, 1.05
    frames = int(round(D * FPS))
    zexp = f"({z0}+({z1}-{z0})*(1-cos(PI*on/{frames}))/2)"   # ease in-out
    if cam == "pan_left": xexp = f"(iw-iw/zoom)*(1-on/{frames})"
    elif cam == "pan_right": xexp = f"(iw-iw/zoom)*(on/{frames})"
    else: xexp = "(iw-iw/zoom)/2"
    yexp = "(ih-ih/zoom)/2"
    S = 2 if media["kind"] == "photo" else 1   # fotos em 2x para movimento sem tremor
    base = (f"scale={W*S}:{H*S}:force_original_aspect_ratio=increase,crop={W*S}:{H*S},setsar=1,"
            f"zoompan=z='{zexp}':x='{xexp}':y='{yexp}':d=1:s={W}x{H}:fps={FPS},")
    vf = (base + GRADES.get(grade, GRADES["teal_orange"]) +
          ",vignette=angle=PI/5,noise=alls=5:allf=t,format=yuv420p")
    if media["kind"] == "photo":
        inp = ["-loop", "1", "-framerate", str(FPS), "-t", f"{D:.3f}", "-i", path_in]
    else:
        L = max(0.0, media.get("dur", 8) - D - 0.3)
        ss = min(L, 0.6 + (idx * 1.7) % max(0.1, L)) if L > 0 else 0
        inp = ["-ss", f"{ss:.2f}", "-t", f"{D:.3f}", "-i", path_in]
        # clipe curto: congela o último quadro em vez de tela preta
        vf = "tpad=stop_mode=clone:stop_duration=4," + vf
    run(["ffmpeg", "-y", *inp, "-vf", vf, "-t", f"{D:.3f}", "-r", str(FPS), "-an",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", out])

# ---------------------------------------------------------------- legendas
def ass_time(t):
    t = max(0, t); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"

def norm(w): return re.sub(r"[^\wÀ-ÿ]", "", w.lower())

def build_ass(words, scenes_t, W, H, out, accent="&H004DD3FF&"):
    vertical = H > W
    fs = 104 if vertical else 84
    y = int(H * (0.70 if vertical else 0.84))
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Leg,Anton,{fs},&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,0,0,0,0,100,100,1,0,1,6,3,5,60,60,0,1
Style: Big,Anton,{int(fs*1.9)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,2,0,1,8,4,5,60,60,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    keys = set()
    for sc in scenes_t:
        for k in sc.get("destaques", []): keys.update(norm(x) for x in k.split())
    # grupos de até 3 palavras, quebrando em pontuação
    groups = []; g = []
    for w in words:
        g.append(w)
        if len(g) >= (2 if vertical else 3) or len(" ".join(x[2] for x in g)) > 16 or re.search(r"[.,!?;:]$", w[2]):
            groups.append(g); g = []
    if g: groups.append(g)
    for gi, g in enumerate(groups):
        g_end = groups[gi + 1][0][0] if gi + 1 < len(groups) else g[-1][1] + 0.3
        g_end = min(g_end, g[-1][1] + 0.6)
        for wi, w in enumerate(g):
            s = w[0]; e = g[wi + 1][0] if wi + 1 < len(g) else g_end
            parts = []
            for wj, x in enumerate(g):
                txt = x[2].upper()
                if wj == wi:
                    col = accent if norm(x[2]) in keys else "&H0000E5FF&"
                    parts.append("{\\c" + col + "\\fscx112\\fscy112}" + txt + "{\\c&HFFFFFF&\\fscx100\\fscy100}")
                elif norm(x[2]) in keys:
                    parts.append("{\\c" + accent + "}" + txt + "{\\c&HFFFFFF&}")
                else:
                    parts.append(txt)
            pop = "{\\fad(60,0)\\fscx88\\fscy88\\t(0,90,\\fscx100\\fscy100)}" if wi == 0 else ""
            ev.append(f"Dialogue: 1,{ass_time(s)},{ass_time(e)},Leg,,0,0,0,,{pop}{{\\pos({W//2},{y})}}" + " ".join(parts))
    # textos de impacto (números, datas, revelações)
    for sc in scenes_t:
        if sc.get("texto_tela"):
            s = sc["t0"] + 0.1; e = min(sc["t1"], s + 2.2)
            ty = int(H * (0.38 if vertical else 0.40))
            ev.append(f"Dialogue: 2,{ass_time(s)},{ass_time(e)},Big,,0,0,0,,{{\\pos({W//2},{ty})\\fad(80,200)\\fscx160\\fscy160\\t(0,180,\\fscx100\\fscy100)\\c{accent}}}"
                      + sc["texto_tela"].upper())
    open(out, "w").write(head + "\n".join(ev) + "\n")

# ---------------------------------------------------------------- principal
TRANS = ["fadeblack", "smoothleft", "zoomin", "smoothup", "dissolve", "circlecrop", "smoothright", "slideleft"]

def main(plan_path, outdir):
    plan = json.load(open(plan_path))
    outdir = os.path.abspath(outdir); os.makedirs(outdir, exist_ok=True)
    work = os.path.join(outdir, "work"); os.makedirs(work, exist_ok=True)
    vertical = plan.get("formato", "9:16") == "9:16"
    W, H = (1080, 1920) if vertical else (1920, 1080)
    scenes = plan["cenas"]; credits = []

    # 1) narração única (ritmo natural) + tempos palavra a palavra
    text = " ".join(s["narracao"].strip() for s in scenes)
    narr = os.path.join(work, "narr.mp3")
    words = None
    voz = plan.get("voz_elevenlabs") or os.environ.get("ELEVENLABS_VOICE_ID") or (
        "pNInz6obpgDQGcFmaJgB" if (os.environ.get("ELEVENLABS_API_KEY") or chaves("elevenlabs")[0]) else None)
    if voz:
        try: words = tts_eleven(text, narr, voz); credits.append("Narração: ElevenLabs")
        except Exception as e: log("ElevenLabs falhou, usando voz neural reserva:", e)
    if not words: words = tts_edge(text, narr); credits.append("Narração: voz neural pt-BR (Microsoft Edge TTS)")
    total = dur(narr) + 0.8

    # 2) mapear cenas -> tempos pela contagem de palavras (corte nunca no meio da palavra)
    idx = 0; tl = []
    for i, s in enumerate(scenes):
        n = len(s["narracao"].split())
        t0 = 0.0 if i == 0 else words[min(idx, len(words) - 1)][0] - 0.05
        idx += n
        t1 = total if i == len(scenes) - 1 else words[min(idx, len(words) - 1)][0] - 0.05
        tl.append({**s, "t0": t0, "t1": t1})
    json.dump({"words": words, "scenes": tl}, open(os.path.join(work, "timeline.json"), "w"), ensure_ascii=False)

    # 3) planos de 2 a 4 s com mídia real que bate com a fala
    used = set(); cache = {}; scene_files = []; T = 0.35
    for i, sc in enumerate(tl):
        D = sc["t1"] - sc["t0"] + (T if i < len(tl) - 1 else 0)
        n = max(1, round(D / 3.0)); cuts = [D / n] * n
        shots = []
        qs = sc.get("buscas") or [sc["narracao"][:40]]
        for j, sd in enumerate(cuts):
            qq = qs[j % len(qs):] + qs[:j % len(qs)]
            src = None
            for _ in range(12):
                m = find_media(qq, vertical, used, cache, sc.get("narracao", ""))
                if not m and APROVADAS:  # nada bom: reaproveita um plano já aprovado (outro enquadramento)
                    m = APROVADAS[(i + j) % len(APROVADAS)]
                if not m: m = find_media(qq, vertical, used, cache)
                used.add(m["id"])
                ext = ".jpg" if m["kind"] == "photo" else ".mp4"
                try: src = download(m["url"], os.path.join(work, m["id"] + ext)); break
                except Exception as e: log("pulando mídia:", e)
            credits.append(m["credit"])
            out = os.path.join(work, f"s{i:02d}_{j:02d}.mp4")
            cams = ["push_in", "pan_right", "pull_out", "pan_left"]
            cam = sc.get("camera") if j == 0 and sc.get("camera") else cams[(i + j) % 4]
            render_shot(m, src, out, W, H, sd, cam, plan.get("grade", sc.get("grade", "teal_orange")), i * 7 + j, punch=(i == 0 and j == 0))
            shots.append(out)
        lst = os.path.join(work, f"scene{i:02d}.txt")
        open(lst, "w").write("".join(f"file '{p}'\n" for p in shots))
        sf = os.path.join(work, f"scene{i:02d}.mp4")
        run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", sf])
        scene_files.append((sf, D)); log(f"cena {i+1}/{len(tl)} pronta ({D:.1f}s, {n} planos)")

    # 4) transições suaves entre cenas (xfade), mantendo sincronia com a fala
    inputs = []; fil = []; off = 0.0; last = "[0:v]"
    for i, (f, D) in enumerate(scene_files): inputs += ["-i", f]
    for i in range(1, len(scene_files)):
        off += scene_files[i - 1][1] - T
        tr = tl[i].get("transicao") or TRANS[i % len(TRANS)]
        fil.append(f"{last}[{i}:v]xfade=transition={tr}:duration={T}:offset={off:.3f}[x{i}]"); last = f"[x{i}]"
    ass = os.path.join(work, "leg.ass"); build_ass(words, tl, W, H, ass)
    fil.append(f"{last}subtitles={ass}:fontsdir={FONTS},fade=t=in:st=0:d=0.3,fade=t=out:st={total-0.6:.2f}:d=0.6[v]")
    video = os.path.join(work, "video.mp4")
    run(["ffmpeg", "-y", *inputs, "-filter_complex", ";".join(fil), "-map", "[v]", "-t", f"{total:.3f}",
         "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", video])

    # 5) som: trilha com ducking, SFX nos cortes e revelações, loudness -14 LUFS
    music = get_music(plan.get("musica", "epico"), total, work, credits)
    sfx_events = [("impact", 0.0)]
    for i, sc in enumerate(tl[1:], 1): sfx_events.append(("whoosh", max(0, sc["t0"] - 0.35)))
    for sc in tl:
        if sc.get("texto_tela"): sfx_events.append(("impact", sc["t0"] + 0.08))
        if sc.get("sfx") == "riser": sfx_events.append(("riser", max(0, sc["t0"] - 1.8)))
    ainp = ["-i", narr, "-stream_loop", "-1", "-i", music]; af = []; mix = []
    for k, (kind, t) in enumerate(sfx_events):
        ainp += ["-i", get_sfx(kind, work, credits)]
        vol = {"whoosh": 0.35, "impact": 0.55, "riser": 0.35, "pop": 0.3}[kind]
        af.append(f"[{k+2}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume={vol},adelay={int(t*1000)}|{int(t*1000)}[f{k}]"); mix.append(f"[f{k}]")
    af.append("[0:a]aformat=sample_rates=44100:channel_layouts=stereo,highpass=f=70,acompressor=threshold=-18dB:ratio=3:attack=5:release=80,volume=1.6,asplit=2[vo][sc]")
    af.append(f"[1:a]aformat=sample_rates=44100:channel_layouts=stereo,atrim=0:{total:.2f},volume=0.33,afade=t=in:d=1,afade=t=out:st={total-2:.2f}:d=2[mu]")
    af.append("[mu][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350[duck]")
    af.append(f"[vo][duck]{''.join(mix)}amix=inputs={2+len(mix)}:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100[a]")
    audio = os.path.join(work, "audio.m4a")
    run(["ffmpeg", "-y", *ainp, "-filter_complex", ";".join(af), "-map", "[a]", "-t", f"{total:.3f}", "-ac", "2", "-ar", "44100", "-c:a", "aac", "-b:a", "192k", audio])

    # 6) final
    tmp = "/tmp/final_" + hashlib.md5(outdir.encode()).hexdigest()[:6] + ".mp4"
    run(["ffmpeg", "-y", "-i", video, "-i", audio, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "copy", "-movflags", "+faststart", "-shortest", tmp])
    final = os.path.join(outdir, re.sub(r"[^\w]+", "-", plan.get("titulo", "video")).strip("-")[:60] + ".mp4")
    shutil.copy(tmp, final)
    meta = [f"TÍTULO: {plan.get('titulo','')}", "", "DESCRIÇÃO:", plan.get("descricao", ""), "",
            "HASHTAGS: " + " ".join(plan.get("hashtags", [])), "", "CRÉDITOS:"] + sorted(set(credits))
    open(os.path.join(outdir, "publicacao.txt"), "w").write("\n".join(meta))
    log("PRONTO:", final, f"{dur(final):.1f}s")
    return final

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
