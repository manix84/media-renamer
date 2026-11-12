import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const directory = path.resolve(process.argv[2] ?? 'release')
const outputName = 'SHA256SUMS.txt'
const entries = (await readdir(directory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name !== outputName)
  .sort((left, right) => left.name.localeCompare(right.name))

if (entries.length === 0) {
  throw new Error(`No release files found in ${directory}`)
}

const lines = []
for (const entry of entries) {
  const contents = await readFile(path.join(directory, entry.name))
  const digest = createHash('sha256').update(contents).digest('hex')
  lines.push(`${digest}  ${entry.name}`)
}

const outputPath = path.join(directory, outputName)
await writeFile(outputPath, `${lines.join('\n')}\n`, 'utf8')
console.log(`Wrote ${entries.length} checksums to ${outputPath}`)
