export const FINANCE_NAVIGATION = Object.freeze([
  { key: "overview", label: "Overview", permission: "finance.workspace.access" },
  { key: "transactions", label: "Transactions", permission: "finance.transactions.view" },
  { key: "accounts", label: "Accounts & Cashboxes", permission: "finance.accounts.view" },
  { key: "funds", label: "Funds", permission: "finance.funds.view" },
  { key: "budgets", label: "Budgets", permission: "finance.budgets.view" },
  { key: "purchase-requests", label: "Purchase Requests", permission: "finance.purchases.view" },
  { key: "reimbursements", label: "Reimbursements", permission: "finance.reimbursements.view" },
  { key: "collections", label: "Income & Collections", permission: "finance.collections.view" },
  { key: "reconciliation", label: "Reconciliation", permission: "finance.reconciliation.view" },
  { key: "periods", label: "Accounting Periods", permission: "finance.periods.view" },
  { key: "reports", label: "Reports", permission: "finance.reports.view" },
  { key: "settings", label: "Finance Settings", permission: "finance.settings.manage" }
]);

export function getVisibleFinanceNavigation(permissionKeys = []) {
  const permissions = new Set(permissionKeys);
  return FINANCE_NAVIGATION.filter((item) => item.key === "overview" || permissions.has(item.permission));
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
    currentMonthIncome: number(value.currentMonthIncome),
    currentMonthExpenses: number(value.currentMonthExpenses),
    pendingReimbursements: number(value.pendingReimbursements),
    pendingPurchaseRequests: number(value.pendingPurchaseRequests),
    accountsNeedingReconciliation: number(value.accountsNeedingReconciliation),
    budgetUsagePercent: number(value.budgetUsagePercent),
    recentTransactions: Array.isArray(value.recentTransactions) ? value.recentTransactions : [],
    actionItems: Array.isArray(value.actionItems) ? value.actionItems : []
  };
}

export function getFinancePermissionKeys(effectiveAccess) {
  return (effectiveAccess?.permissions ?? []).map((permission) => permission.key ?? permission.permissionKey ?? permission.permission_id).filter(Boolean);
}
