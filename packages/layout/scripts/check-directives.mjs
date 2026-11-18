// 빌드 산출물에서 client 모듈(parts.js) 첫 문장이 "use client"인지 확인한다.
// entry(index.js)는 서버 모듈이다. namespace re-export(`export * as X`)가 Server Component에서
// 점 표기(<X.Root>)로 동작하려면 entry가 client 모듈이면 안 된다.
import { readFileSync } from 'node:fs'

const entries = ['side-panels', 'tiling', 'grid']
let failed = false
for (const entry of entries) {
  const read = (name) => readFileSync(new URL(`../dist/${entry}/${name}`, import.meta.url), 'utf8')
  const first = (src) => (src.trimStart().split('\n')[0] ?? '').trim()
  const isClient = (src) => /^["']use client["'];?$/.test(first(src))
  let parts
  try {
    parts = read('parts.js')
  } catch {
    console.error(`dist/${entry}/parts.js missing`)
    failed = true
    continue
  }
  if (!isClient(parts)) {
    console.error(`dist/${entry}/parts.js: "use client" directive missing`)
    failed = true
  }
  if (isClient(read('index.js'))) {
    console.error(`dist/${entry}/index.js must not be a client module`)
    failed = true
  }
}
if (failed) process.exit(1)
console.log('"use client" directives OK (parts.js client, index.js server)')
