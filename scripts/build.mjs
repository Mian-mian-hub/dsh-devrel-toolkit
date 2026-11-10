import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'

await mkdir(new URL('../dist/', import.meta.url), { recursive: true })
for (const file of await readdir(new URL('../src/', import.meta.url))) {
  if (!file.endsWith('.ts')) continue
  const source = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')
  await writeFile(new URL(`../dist/${file.replace(/\.ts$/, '.js')}`, import.meta.url), stripTypeScriptTypes(source).replace(/(from\s+['"]\.\.?\/[^'"]+)\.ts(['"])/g, '$1.js$2'))
}
