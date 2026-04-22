import { spawn } from 'node:child_process'
import type { UsageProfile } from './schema.js'

export async function output(profile: UsageProfile, jsonOnly: boolean, copy: boolean): Promise<void> {
  if (!jsonOnly) {
    const headers = ['Tool', 'Verdict', 'Sessions', 'Messages', 'Input Tokens', 'Output Tokens']

    const rows: string[][] = profile.tools.map((t) => {
      if (t.metrics === null) {
        return [t.tool, t.verdict, '-', '-', '-', '-']
      }
      return [
        t.tool,
        t.verdict,
        String(t.metrics.sessions),
        String(t.metrics.messages),
        String(t.metrics.inputTokens),
        String(t.metrics.outputTokens),
      ]
    })

    // Compute column widths
    const colWidths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map((r) => r[i].length))
    )

    const pad = (s: string, w: number) => s.padEnd(w)
    const separator = '+' + colWidths.map((w) => '-'.repeat(w + 2)).join('+') + '+'
    const formatRow = (cells: string[]) =>
      '| ' + cells.map((c, i) => pad(c, colWidths[i])).join(' | ') + ' |'

    console.log(separator)
    console.log(formatRow(headers))
    console.log(separator)
    for (const row of rows) {
      console.log(formatRow(row))
    }
    console.log(separator)
    console.log()
  }

  const json = JSON.stringify(profile, null, 2)
  console.log(json)

  if (copy) {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('pbcopy', [], { stdio: ['pipe', 'inherit', 'inherit'] })
      proc.stdin.write(json)
      proc.stdin.end()
      proc.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`pbcopy exited with code ${code}`))
        }
      })
      proc.on('error', reject)
    })
    process.stderr.write('✓ Copied to clipboard.\n')
  }
}
