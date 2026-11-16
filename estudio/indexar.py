"""Guarda o vídeo no catálogo do sistema (videos.json no GitHub Pages)."""
import json, os, sys, datetime
idx_path, n, pub_path = sys.argv[1], int(sys.argv[2]), sys.argv[3]
pedido = sys.argv[4] if len(sys.argv) > 4 else ""
txt = open(pub_path, encoding="utf-8").read()
def sec(nome, prox):
    if nome not in txt: return ""
    s = txt.split(nome, 1)[1]
    for p in prox:
        if p in s: s = s.split(p, 1)[0]
    return s.strip()
titulo = sec("TÍTULO:", ["\n"])
desc = sec("DESCRIÇÃO:", ["HASHTAGS:"])
tags = sec("HASHTAGS:", ["\n"])
cred = [c for c in sec("CRÉDITOS:", []).splitlines() if c.strip()]
dur = float(os.environ.get("DUR", "0") or 0)
try: lst = json.load(open(idx_path, encoding="utf-8"))
except Exception: lst = []
lst = [v for v in lst if v.get("n") != n]
lst.insert(0, {"n": n, "titulo": titulo, "descricao": desc, "hashtags": tags, "creditos": cred,
               "pedido": pedido.replace("🎬", "").strip(), "duracao": round(dur, 1),
               "video": f"videos/video-{n}.mp4", "capa": f"videos/video-{n}.jpg",
               "data": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=-3))).strftime("%d/%m/%Y %H:%M")})
os.makedirs(os.path.dirname(idx_path) or ".", exist_ok=True)
json.dump(lst, open(idx_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("catálogo:", len(lst), "vídeos")
