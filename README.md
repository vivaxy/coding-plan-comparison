# Coding Plan Comparison

Compare AI coding subscription plans (Claude Max, ChatGPT Pro, Cursor Ultra, Windsurf, Copilot, Gemini Code Assist, etc.) by cost-effectiveness against your real usage.

## Structure

- **`web/`** — Static webpage. Open `web/dist/index.html` in a browser or visit the GitHub Pages URL. No server required.
- **`cli/`** — Local CLI: `npx coding-plan-comparison`. Reads AI coding tool data from your machine and outputs a usage profile JSON to paste into the webpage.

## Quickstart

1. Run the CLI to collect your usage data:
   ```sh
   npx coding-plan-comparison --copy
   ```
2. Open the [webpage](https://vivaxy.github.io/coding-plan-comparison/) and go to the **Import** tab.
3. Paste the JSON and click **Import**.
4. Check the **Recommend** tab — your highest-value plan is ranked first.

## Privacy

The CLI reads only local files on your machine. Nothing is uploaded or transmitted.
