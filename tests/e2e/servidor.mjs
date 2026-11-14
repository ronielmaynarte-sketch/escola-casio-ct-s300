// Servidor estático mínimo para os testes E2E (serve a pasta dist/ como o GitHub Pages).
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const raiz = join(process.cwd(), 'dist')
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }
createServer(async (req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0])
  if (p.endsWith('/')) p += 'index.html'
  const arq = normalize(join(raiz, p))
  if (!arq.startsWith(raiz)) return res.writeHead(403).end()
  try {
    const dados = await readFile(arq)
    res.writeHead(200, { 'content-type': tipos[extname(arq)] || 'application/octet-stream' }).end(dados)
  } catch {
    res.writeHead(404).end('404')
  }
}).listen(Number(process.env.PORTA || 4173), '127.0.0.1', () => console.log('pronto'))
