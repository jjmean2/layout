// 빌드 산출물 검사.
// 1. client 모듈(parts.js)의 첫 문장은 "use client"이고, entry(index.js)는 서버 모듈이다.
//    entry가 client 모듈이면 Server Component에서 <X.Root> 점 표기가 동작하지 않는다.
// 2. 모든 entry를 Node ESM으로 import할 수 있다. 번들하지 않는 소비자(Node, Vitest, Vite SSR)를 위한 검사.
import { readFileSync } from 'node:fs'

const entries = ['side-panels', 'tiling', 'grid']
const failures = []

const firstLine = (src) => (src.trimStart().split('\n')[0] ?? '').trim()
const isClient = (src) => /^["']use client["'];?$/.test(firstLine(src))

for (const entry of entries) {
  const read = (name) => readFileSync(new URL(`../dist/${entry}/${name}`, import.meta.url), 'utf8')
  if (!isClient(read('parts.js'))) failures.push(`dist/${entry}/parts.js: "use client" directive missing`)
  if (isClient(read('index.js'))) failures.push(`dist/${entry}/index.js must not be a client module`)
  try {
    const mod = await import(new URL(`../dist/${entry}/index.js`, import.meta.url).href)
    if (Object.keys(mod).length === 0) failures.push(`dist/${entry}/index.js has no exports`)
  } catch (error) {
    failures.push(`dist/${entry}/index.js cannot be imported by Node: ${error.code ?? error.message}`)
  }
}

if (failures.length) {
  for (const f of failures) console.error(f)
  process.exit(1)
}
console.log('dist OK: directives in place, every entry importable by Node')
