import { Account } from "./account.ts";
import { type Entry, postEntry } from "./entry.ts";

export class Ledger {
  readonly accounts = new Map<string, Account>();
  readonly entries: Entry[] = [];
  open(account: Account): void { this.accounts.set(account.code, account); }
  post(entry: Entry): void { postEntry(this, entry); this.entries.push(entry); }
  balance(code: string): number { return this.accounts.get(code)?.balance ?? 0; }
}
