import type { Ledger } from "./ledger.ts";
export interface Line { account: string; debit?: number; credit?: number }
export interface Entry { date: string; memo: string; lines: Line[] }
export function postEntry(ledger: Ledger, entry: Entry): void {
  const debits = entry.lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const credits = entry.lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  if (Math.abs(debits - credits) > 0.005) throw new Error(`unbalanced entry: ${debits} vs ${credits}`);
  for (const line of entry.lines) {
    const account = ledger.accounts.get(line.account);
    if (!account) throw new Error(`unknown account ${line.account}`);
    account.balance += (line.debit ?? 0) - (line.credit ?? 0);
  }
}
