import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

// The Mulberry Symbols (mulberry-symbols/, © Steve Lee, CC BY-SA 4.0) at /symbols/<name>.svg, plus /symbols/index.json
// for the editor's search. The few symbols the set marks as rated (anatomy) are left out. The app's own symbols
// (own-symbols/, for words Mulberry has no picture for, such as "I") are served the same way.
const OWN: { n: string; t: string; c: string }[] = [{ n: 'I_me', t: 'I me myself pronoun person', c: 'Communicator' }]

function mulberry(): Plugin {
  const root = fileURLToPath(new URL('./mulberry-symbols', import.meta.url))
  const svgs = path.join(root, 'EN-symbols')
  const own = fileURLToPath(new URL('./own-symbols', import.meta.url))
  const bliss = fileURLToPath(new URL('./bliss-symbols', import.meta.url))
  const scenes = fileURLToPath(new URL('./scene-symbols', import.meta.url))
  function fileOf(name: string) {
    if (name.startsWith('scene_')) return path.join(scenes, `${name}.svg`)
    if (name.startsWith('bliss_')) return path.join(bliss, `${name}.svg`)
    return path.join(OWN.some(symbol => symbol.n === name) ? own : svgs, `${name}.svg`)
  }
  let outDir = 'dist'

  // One CSV line's fields. Names with commas ("eat_,_to") are quoted.
  function fields(line: string): string[] {
    const cells: string[] = []
    let cell = '', quoted = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (quoted && c === '"' && line[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = !quoted
      else if (c === ',' && !quoted) { cells.push(cell); cell = '' }
      else cell += c
    }
    cells.push(cell)
    return cells
  }

  function readIndex() {
    const lines = fs.readFileSync(path.join(root, 'symbol-info.csv'), 'utf8').split(/\r?\n/).slice(1).filter(Boolean)
    const symbols: { n: string; t: string; c: string }[] = []
    for (const line of lines) {
      // symbol-id,category-id,grammar,rated,tags,symbol-en,category-en,symbol-fr,category-fr
      const [, , , rated, tags, name, category] = fields(line)
      if (rated === '0' && name && fs.existsSync(path.join(svgs, `${name}.svg`))) symbols.push({ n: name, t: tags, c: category })
    }
    function entries(dir: string, category: string) {
      return fs.readdirSync(dir).filter(file => file.endsWith('.svg')).map(file => {
        const name = path.basename(file, '.svg')
        return { n: name, t: name.slice(name.indexOf('_') + 1).replaceAll('_', ' '), c: category }
      })
    }
    return [...OWN, ...entries(scenes, 'Picture scenes'), ...symbols, ...entries(bliss, 'Blissymbols')]
  }

  return {
    name: 'mulberry-symbols',
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir) },
    configureServer(server) {
      const index = JSON.stringify(readIndex())
      const allowed = new Set(JSON.parse(index).map((symbol: { n: string }) => `${symbol.n}.svg`))
      server.middlewares.use('/symbols', (req, res, next) => {
        const file = decodeURIComponent((req.url || '').split('?')[0].replace(/^\//, ''))
        if (file === 'index.json') { res.setHeader('Content-Type', 'application/json'); res.end(index); return }
        if (!allowed.has(file)) return next()
        res.setHeader('Content-Type', 'image/svg+xml')
        fs.createReadStream(fileOf(file.replace(/\.svg$/, ''))).pipe(res)
      })
    },
    closeBundle() {
      const symbols = readIndex()
      const target = path.join(outDir, 'symbols')
      fs.mkdirSync(target, { recursive: true })
      for (const symbol of symbols) fs.copyFileSync(fileOf(symbol.n), path.join(target, `${symbol.n}.svg`))
      fs.writeFileSync(path.join(target, 'index.json'), JSON.stringify(symbols))
    },
  }
}

export default defineConfig({
  plugins: [react(), mulberry()],
  // In development the Worker runs separately (npm run dev:worker); the
  // deployed app serves both from one origin.
  server: {
    proxy: { '/api': { target: 'http://127.0.0.1:8787' } },
  },
})
