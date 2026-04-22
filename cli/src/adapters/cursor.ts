import { join } from 'node:path'
import { homedir } from 'node:os'
import { makeVscodeSqliteAdapter } from './vscodeSqlite.js'

export default makeVscodeSqliteAdapter({
  name: 'cursor',
  tool: 'cursor',
  dbPath: join(homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
  manualPrompts: [
    {
      field: 'cursor.premiumRequestsUsed',
      label: 'Premium requests used this month',
      hint: 'Open Cursor → Settings → Billing, or visit https://www.cursor.com/settings',
    },
    {
      field: 'cursor.premiumRequestsLimit',
      label: 'Premium request limit (your plan)',
      hint: 'Shown on the same Cursor billing page',
    },
  ],
})
