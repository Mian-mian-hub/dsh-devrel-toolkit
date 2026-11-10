import { randomBytes } from 'node:crypto'
import { readFile, writeFile, chmod } from 'node:fs/promises'
import { parseEnv } from 'node:util'
const file = new URL('../.env.local', import.meta.url)
const repository = process.argv[2]
if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
  console.error('Usage: npm run setup:issues -- owner/repository'); process.exit(1)
}
try {
  const values = parseEnv(await readFile(file, 'utf8'))
  if (values.DEVREL_GITHUB_REPOSITORIES !== repository || !values.DSH_GITHUB_WEBHOOK_SECRET) {
    throw new Error('Existing .env.local differs or is incomplete; edit it explicitly. Existing secrets were preserved.')
  }
  console.log('Existing local configuration is ready; secret preserved.')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  await writeFile(file, [
    `DEVREL_GITHUB_REPOSITORIES=${repository}`,
    'DEVREL_WEBHOOK_PORT=3081',
    `DSH_GITHUB_WEBHOOK_SECRET=${randomBytes(32).toString('hex')}`, '',
  ].join('\n'), { flag: 'wx', mode: 0o600 })
  console.log('Created private .env.local with a persistent random webhook secret.')
}
await chmod(file, 0o600)
console.log(`Target: ${repository}\nNext: npm run start:issues\nThen: configure a model in DSH Settings → Models.`)
