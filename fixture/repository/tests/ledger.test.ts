import { test } from "node:test";
import assert from "node:assert/strict";
import { Ledger, Account, AccountKind } from "../src/index.ts";

test("a balanced entry posts", () => {
  const l = new Ledger();
  l.open(new Account("1000", "Cash", AccountKind.Asset));
  l.open(new Account("4000", "Sales", AccountKind.Income));
  l.post({ date: "2026-01-02", memo: "invoice 1", lines: [{ account: "1000", debit: 100 }, { account: "4000", credit: 100 }] });
  assert.equal(l.balance("1000"), 100);
});
