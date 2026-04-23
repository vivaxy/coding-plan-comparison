# coding-plan-comparison

CLI to collect AI coding tool usage data from your local machine and export it for plan comparison.

## Usage

```sh
# Collect all detected tools, print summary + JSON
npx coding-plan-comparison

# Output JSON only (for piping or redirect)
npx coding-plan-comparison --json

# Copy JSON to clipboard (macOS)
npx coding-plan-comparison --copy

# Limit to a date range
npx coding-plan-comparison --since 2026-03-01 --until 2026-04-22

# Only specific tools
npx coding-plan-comparison --tools claude-code,codex
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

## Releasing

Releases are automated via [semantic-release](https://semantic-release.gitbook.io/). Merging a Conventional Commit to `main` triggers a release if the changes are releasable:

| Commit prefix | Version bump |
|---|---|
| `fix:` / `fix(cli):` | patch |
| `feat:` / `feat(cli):` | minor |
| `BREAKING CHANGE:` footer | major |

Tag format: `cli-vX.Y.Z`. The workflow publishes to npm with OIDC provenance and creates a GitHub Release automatically.

### One-time setup

1. **Claim the package name on npm** — `npm login && npm publish --access public` from this directory to create the package before CI takes over.
2. **Configure Trusted Publishing on npmjs.com** — package settings → "Automated Publishing" → add GitHub Actions publisher for `vivaxy/coding-plan-comparison`, workflow `release-cli.yml`. No `NPM_TOKEN` secret is needed after this.
3. **Tag the initial version** — before the first automated release, tag the current commit so semantic-release starts from the right base:
   ```sh
   git tag cli-v0.1.0 && git push origin cli-v0.1.0
   ```
