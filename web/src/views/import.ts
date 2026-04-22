import type { UsageProfile } from '../lib/schema.js'

export function renderImport(app: HTMLElement): void {
  const stored = localStorage.getItem('usageProfile')
  const profile: UsageProfile | null = stored ? JSON.parse(stored) : null
  const manualData: Record<string, number> = JSON.parse(localStorage.getItem('manualData') ?? '{}')

  const manualTools = profile?.tools.filter(t => t.manualPrompts?.length) ?? []

  const manualSection = profile ? `
    <h3 style="margin:28px 0 8px;font-size:15px;color:#f1f5f9">Manual Data</h3>
    <p style="color:#94a3b8;margin-bottom:16px">Fill in values from your provider dashboards:</p>
    ${manualTools.map(t => t.manualPrompts!.map(p => `
      <div style="margin-bottom:14px">
        <label style="display:block;margin-bottom:4px;color:#cbd5e1">${p.label}</label>
        <input type="number" data-field="${p.field}"
          value="${manualData[p.field] ?? ''}"
          style="width:220px;background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:8px 12px;font-family:inherit;font-size:13px;outline:none">
        <small style="display:block;margin-top:4px;color:#64748b">${p.hint}</small>
      </div>`).join('')).join('')}
    <button id="btn-save-manual" style="margin-top:4px">Save Manual Data</button>
    <div id="manual-feedback"></div>
  ` : ''

  const summarySection = profile ? `
    <h3 style="margin:28px 0 8px;font-size:15px;color:#f1f5f9">Current Profile</h3>
    <p style="color:#94a3b8;margin-bottom:4px">Generated: ${profile.generatedAt} &nbsp;|&nbsp; Range: ${profile.range.from} → ${profile.range.to}</p>
    <table>
      <thead><tr><th>Tool</th><th>Verdict</th><th>Sessions</th><th>Messages</th><th>Tokens (in/out)</th></tr></thead>
      <tbody>${profile.tools.map(t => `
        <tr>
          <td>${t.tool}</td>
          <td>${t.verdict}</td>
          <td>${t.metrics?.sessions ?? '—'}</td>
          <td>${t.metrics?.messages ?? '—'}</td>
          <td>${t.metrics ? `${t.metrics.inputTokens.toLocaleString()} / ${t.metrics.outputTokens.toLocaleString()}` : '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  ` : ''

  app.innerHTML = `
    <h2>Import Usage Profile</h2>
    <p style="color:#94a3b8;margin-bottom:16px">Run <code style="background:#1e293b;padding:2px 6px;border-radius:4px">npx coding-plan-usage --copy</code> then paste the JSON below.</p>
    <textarea rows="10" id="profile-json" placeholder="Paste JSON here..."></textarea>
    <button id="btn-import" style="margin-top:12px">Import</button>
    <div id="import-feedback"></div>
    ${manualSection}
    ${summarySection}
  `

  document.getElementById('btn-import')!.addEventListener('click', () => {
    const feedback = document.getElementById('import-feedback')!
    const raw = (document.getElementById('profile-json') as HTMLTextAreaElement).value.trim()
    try {
      const parsed = JSON.parse(raw) as UsageProfile
      if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.tools)) {
        throw new Error('Invalid profile: expected schemaVersion 1 and a tools array.')
      }
      localStorage.setItem('usageProfile', JSON.stringify(parsed))
      renderImport(app)
      document.getElementById('import-feedback')!.className = 'success'
      document.getElementById('import-feedback')!.textContent = `✓ Imported ${parsed.tools.length} tool(s)`
    } catch (e) {
      feedback.className = 'error'
      feedback.textContent = `Error: ${(e as Error).message}`
    }
  })

  document.getElementById('btn-save-manual')?.addEventListener('click', () => {
    const updated: Record<string, number> = JSON.parse(localStorage.getItem('manualData') ?? '{}')
    document.querySelectorAll<HTMLInputElement>('input[data-field]').forEach(input => {
      const field = input.dataset.field!
      const val = parseFloat(input.value)
      if (!isNaN(val)) updated[field] = val
    })
    localStorage.setItem('manualData', JSON.stringify(updated))
    const fb = document.getElementById('manual-feedback')!
    fb.className = 'success'
    fb.textContent = '✓ Saved'
  })
}
