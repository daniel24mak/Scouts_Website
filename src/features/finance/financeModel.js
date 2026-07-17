export const FINANCE_NAVIGATION = Object.freeze([
  { key: "overview", label: "Overview", permission: "finance.workspace.access" },
  { key: "aiAssistant", label: "AI Assistant", permission: "finance.workspace.access" },
  { key: "transactions", label: "Transactions", group: "Operations", permissions: ["finance.transactions.view"] },
  { key: "purchase-requests", label: "Purchase Requests", group: "Operations", permissions: ["finance.purchases.view"] },
  { key: "reimbursements", label: "Reimbursements", group: "Operations", permissions: ["finance.reimbursements.view"] },
  { key: "collections", label: "Income & Collections", group: "Operations", permissions: ["finance.collections.view"] },
  { key: "accounts-funds", label: "Accounts & Funds", group: "Planning & Control", permissions: ["finance.accounts.view", "finance.funds.view"] },
  { key: "budgets", label: "Budgets", group: "Planning & Control", permissions: ["finance.budgets.view"] },
  { key: "reconciliation-periods", label: "Reconciliation & Periods", group: "Planning & Control", permissions: ["finance.reconciliation.view", "finance.periods.view"] },
  { key: "reports", label: "Reports", group: "Insights", permissions: ["finance.reports.view"] },
  { key: "settings", label: "Finance Settings", permission: "finance.settings.manage" }
]);

export const FINANCE_SECTION_TABS = Object.freeze({
  "accounts-funds": Object.freeze([{ key: "accounts", label: "Accounts" }, { key: "funds", label: "Funds" }, { key: "categories", label: "Categories" }]),
  reimbursements: Object.freeze([{ key: "requests", label: "Requests" }, { key: "forms", label: "Reimbursement Forms" }]),
  collections: Object.freeze([{ key: "income", label: "Income" }, { key: "campaigns", label: "Campaigns" }, { key: "charges-payments", label: "Charges & Payments" }]),
  "reconciliation-periods": Object.freeze([{ key: "reconciliation", label: "Reconciliation" }, { key: "periods", label: "Accounting Periods" }])
});

export function getVisibleFinanceNavigation(permissionKeys = []) {
  const permissions = new Set(permissionKeys);
  return FINANCE_NAVIGATION.filter((item) => ["overview", "aiAssistant"].includes(item.key) || permissions.has(item.permission) || item.permissions?.some((key) => permissions.has(key)));
}

export function formatFinanceAmount(value, currency = "AED") {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

export function normalizeFinanceOverview(value = {}) {
  const number = (input) => Number.isFinite(Number(input)) ? Number(input) : 0;
  return {
    totalBalance: number(value.totalBalance),
    committedFunds: number(value.committedFunds),
    currentMonthIncome: number(value.currentMonthIncome),
    currentMonthExpenses: number(value.currentMonthExpenses),
    pendingReimbursements: number(value.pendingReimbursements),
    pendingPurchaseRequests: number(value.pendingPurchaseRequests),
    accountsNeedingReconciliation: number(value.accountsNeedingReconciliation),
    accountCount: number(value.accountCount),
    budgetUsagePercent: number(value.budgetUsagePercent),
    recentTransactions: Array.isArray(value.recentTransactions) ? value.recentTransactions : [],
    actionItems: Array.isArray(value.actionItems) ? value.actionItems : []
  };
}

export function getFinancePermissionKeys(effectiveAccess) {
  return (effectiveAccess?.permissions ?? []).map((permission) => permission.key ?? permission.permissionKey ?? permission.permission_id).filter(Boolean);
}
