import assert from "node:assert/strict";
import test from "node:test";
import {
  FINANCE_NAVIGATION,
  FINANCE_SECTION_TABS,
  formatFinanceAmount,
  getVisibleFinanceNavigation,
  normalizeFinanceOverview
} from "../../src/features/finance/financeModel.js";

test("finance navigation is grouped around user workflows and permission filtered", () => {
  assert.deepEqual(FINANCE_NAVIGATION.map((item) => item.key), [
    "overview", "aiAssistant", "transactions", "purchase-requests", "reimbursements", "collections",
    "accounts-funds", "budgets", "reconciliation-periods", "reports", "myWork", "notifications", "settings"
  ]);
  assert.deepEqual(getVisibleFinanceNavigation(["finance.transactions.view"]).map((item) => item.key), ["overview", "aiAssistant", "transactions", "myWork", "notifications"]);
  assert.equal(getVisibleFinanceNavigation(["finance.workspace.access"]).length, 4);
  assert.deepEqual(FINANCE_SECTION_TABS["accounts-funds"].map((tab) => tab.key), ["accounts", "funds", "categories"]);
  assert.deepEqual(FINANCE_SECTION_TABS.reimbursements.map((tab) => tab.key), ["requests", "forms"]);
  assert.deepEqual(FINANCE_SECTION_TABS.collections.map((tab) => tab.key), ["income", "campaigns", "charges-payments"]);
  assert.deepEqual(FINANCE_SECTION_TABS["reconciliation-periods"].map((tab) => tab.key), ["reconciliation", "periods"]);
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
    committedFunds: 0,
    accountsNeedingReconciliation: 0,
    accountCount: 0,
    budgetUsagePercent: 0,
    recentTransactions: [],
    actionItems: []
  });
});
