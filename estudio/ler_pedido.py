"""Lê o pedido do issue (criado pela página) e gera os argumentos do diretor."""
import json, os, re, sys
body = os.environ.get("BODY", "")
title = os.environ.get("TITLE", "")
def campo(n, d=""):
    m = re.search(rf"^{n}:\s*(.*)$", body, re.M | re.I)
    return m.group(1).strip() if m else d
modo = campo("modo", "tema").lower()
fmt = campo("formato", "9:16"); fmt = fmt if fmt in ("9:16", "16:9") else "9:16"
dur = re.sub(r"\D", "", campo("duracao", "50")) or "50"
dur = str(max(15, min(180, int(dur))))
texto = body.split("---", 1)[1].strip() if "---" in body else campo("tema", title.replace("🎬", "").strip())
args = ["--formato", fmt, "--duracao", dur]
if modo == "roteiro":
    open("roteiro.txt", "w").write(texto); args += ["--roteiro", "roteiro.txt"]
else:
    args += ["--tema", texto]
open("args.json", "w").write(json.dumps(args, ensure_ascii=False))
print(args)
