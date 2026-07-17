import assert from "node:assert/strict";
import test from "node:test";
import {
  FINANCE_NAVIGATION,
  formatFinanceAmount,
  getVisibleFinanceNavigation,
  normalizeFinanceOverview
} from "../../src/features/finance/financeModel.js";

test("finance navigation is granular and permission filtered", () => {
  assert.deepEqual(FINANCE_NAVIGATION.map((item) => item.key), [
    "overview", "transactions", "accounts", "funds", "budgets", "purchase-requests",
    "reimbursements", "collections", "reconciliation", "periods", "reports", "settings"
  ]);
  assert.deepEqual(getVisibleFinanceNavigation(["finance.transactions.view"]).map((item) => item.key), ["overview", "transactions"]);
  assert.equal(getVisibleFinanceNavigation(["finance.workspace.access"]).length, 1);
});

test("finance amounts use AED and preserve negative values", () => {
  assert.match(formatFinanceAmount(1234.5), /1,234\.50/);
  assert.match(formatFinanceAmount(-25), /-.*25\.00|25\.00.*-/);
});

test("finance overview normalizes missing and numeric Supabase values safely", () => {
  assert.deepEqual(normalizeFinanceOverview({ currentMonthIncome: "100.25", pendingPurchaseRequests: "3" }), {
    totalBalance: 0,
    currentMonthIncome: 100.25,
    currentMonthExpenses: 0,
    pendingReimbursements: 0,
    pendingPurchaseRequests: 3,
    accountsNeedingReconciliation: 0,
    budgetUsagePercent: 0,
    recentTransactions: [],
    actionItems: []
  });
});
