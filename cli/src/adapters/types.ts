import type { ToolUsage } from '../schema.js'

export interface DateRange {
  from: Date;
  to: Date;
}

export interface Adapter {
  readonly name: string;  // matches ToolUsage.tool values: 'claude-code', 'codex', etc.
  detect(): Promise<boolean>;
  collect(range: DateRange): Promise<ToolUsage>;
}
