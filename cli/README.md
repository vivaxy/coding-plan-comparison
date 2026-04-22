# coding-plan-usage

CLI to collect AI coding tool usage data from your local machine and export it for plan comparison.

## Usage

```sh
# Collect all detected tools, print summary + JSON
npx coding-plan-usage

# Output JSON only (for piping or redirect)
npx coding-plan-usage --json

# Copy JSON to clipboard (macOS)
npx coding-plan-usage --copy

# Limit to a date range
npx coding-plan-usage --since 2026-03-01 --until 2026-04-22

# Only specific tools
npx coding-plan-usage --tools claude-code,codex
```

## Adapter coverage

| Tool | Verdict | Data available |
|---|---|---|
| Claude Code | Rich | Tokens (4 kinds), sessions, messages, model breakdown |
| Codex CLI | Partial→Rich | Sessions, messages; tokens if sqlite present |
| Cursor | Minimal | Conversation count; quota is manual (in-app dashboard) |
| Windsurf | Minimal | Conversation count; quota is manual |
| GitHub Copilot | Manual | No local data — follow guidance URL |
| Gemini CLI | Manual | No local data — follow guidance URL |

## Privacy

Everything runs locally. No data is sent anywhere. The JSON output contains only aggregated usage counts from files already on your machine.
