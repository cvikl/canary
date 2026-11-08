export enum AccountKind { Asset = "asset", Liability = "liability", Equity = "equity", Income = "income", Expense = "expense" }
export class Account {
  balance = 0;
  constructor(readonly code: string, readonly name: string, readonly kind: AccountKind) {}
}
