import { join } from 'node:path'
import { homedir } from 'node:os'
import { makeVscodeSqliteAdapter } from './vscodeSqlite.js'

export default makeVscodeSqliteAdapter({
  name: 'windsurf',
  tool: 'windsurf',
  dbPath: join(homedir(), 'Library', 'Application Support', 'Windsurf', 'User', 'globalStorage', 'state.vscdb'),
  manualPrompts: [
    {
      field: 'windsurf.flowActionsUsed',
      label: 'Flow actions used this month',
      hint: 'Open Windsurf → Settings → Account, or visit https://windsurf.com/account',
    },
    {
      field: 'windsurf.flowActionsLimit',
      label: 'Flow action limit (your plan)',
      hint: 'Shown on the same Windsurf account page',
    },
  ],
})
