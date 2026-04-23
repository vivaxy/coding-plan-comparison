import type { Adapter, DateRange } from './types.js'
import type { ToolUsage } from '../schema.js'

export class CopilotAdapter implements Adapter {
  readonly name = 'copilot'

  async detect(): Promise<boolean> {
    return true
  }

  async collect(_range: DateRange): Promise<ToolUsage> {
    return {
      tool: 'copilot',
      verdict: 'manual',
      metrics: null,
      manualPrompts: [
        {
          field: 'copilot.chatsThisMonth',
          label: 'Chat messages sent this month',
          hint: 'Visit https://github.com/settings/copilot — usage shown under "Usage"'
        },
        {
          field: 'copilot.premiumRequestsUsed',
          label: 'Premium model requests used this month',
          hint: 'Same GitHub Copilot settings page — "Premium requests"'
        }
      ],
    }
  }
}

export default new CopilotAdapter()
