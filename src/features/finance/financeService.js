import { callSupabaseRpc, getCurrentSupabaseUserId, getSupabaseRows, insertSupabaseRow } from "../../services/supabaseClient.js";
import { normalizeFinanceOverview } from "./financeModel.js";

const toEntry = (row) => ({
  id: row.id,
  referenceNumber: row.reference_number,
  entryType: row.entry_type,
  status: row.status,
  entryDate: row.entry_date,
  description: row.description,
  postedAt: row.posted_at
});

const toAccount = (row) => ({
  id: row.id,
  name: row.name,
  account_type: row.account_type,
  accountType: row.account_type,
  currency: row.currency,
  description: row.description,
  is_active: row.is_active,
  reconciliationStatus: row.reconciliation_status,
  lastReconciledOn: row.last_reconciled_on,
  isActive: row.is_active
});

export async function getFinanceOverview() {
  const [balances, entries, accounts, summary, purchases, reimbursements] = await Promise.all([
    getSupabaseRows("finance_account_balances", "select=account_id,currency,calculated_balance"),
    getSupabaseRows("finance_journal_entries", "select=id,reference_number,entry_type,status,entry_date,description,posted_at&order=entry_date.desc,created_at.desc&limit=8"),
    getSupabaseRows("finance_accounts", "select=id,name,account_type,currency,reconciliation_status,last_reconciled_on,is_active&is_active=eq.true&order=name.asc"),
    getSupabaseRows("finance_income_expense_summary", "select=entry_date,entry_type,amount&order=entry_date.desc&limit=400"),
    getSupabaseRows("finance_purchase_requests", "select=id,amount,status&status=in.(approved,ordered,partially_received)"),
    getSupabaseRows("finance_reimbursements", "select=id,status&status=in.(pending_approval,approved,scheduled)")
  ]);
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const monthRows = summary.filter((row) => String(row.entry_date).startsWith(month));
  return normalizeFinanceOverview({
    totalBalance: balances.reduce((total, row) => total + Number(row.calculated_balance || 0), 0),
    committedFunds: purchases.reduce((total, row) => total + Number(row.amount || 0), 0),
    pendingReimbursements: reimbursements.length,
    currentMonthIncome: monthRows.filter((row) => ["income", "collection"].includes(row.entry_type)).reduce((total, row) => total + Number(row.amount || 0), 0),
    currentMonthExpenses: monthRows.filter((row) => ["expense", "reimbursement", "refund"].includes(row.entry_type)).reduce((total, row) => total + Number(row.amount || 0), 0),
    accountsNeedingReconciliation: accounts.filter((account) => account.reconciliation_status === "needs_review").length,
    accountCount: accounts.length,
    recentTransactions: entries.map(toEntry)
  });
}

async function getFinanceLeafData(section) {
  if (section === "transactions") {
    return (await getSupabaseRows("finance_journal_entries", "select=id,reference_number,entry_type,status,entry_date,description,posted_at&order=entry_date.desc,created_at.desc&limit=100")).map(toEntry);
  }
  if (section === "accounts") {
    const [accounts, balances] = await Promise.all([
      getSupabaseRows("finance_accounts", "select=id,name,account_type,currency,reconciliation_status,last_reconciled_on,is_active&order=name.asc"),
      getSupabaseRows("finance_account_balances", "select=account_id,currency,calculated_balance")
    ]);
    const balanceByAccount = new Map(balances.map((row) => [row.account_id, Number(row.calculated_balance || 0)]));
    return accounts.map((row) => ({ ...toAccount(row), calculatedBalance: balanceByAccount.get(row.id) ?? 0 }));
  }
  if (section === "funds") return getSupabaseRows("finance_funds", "select=id,code,name,description,is_restricted,is_active,parent_id&order=name.asc");
  if (section === "categories") return getSupabaseRows("finance_categories", "select=id,code,name,category_type,is_active&order=name.asc");
  if (section === "periods") return getSupabaseRows("finance_accounting_periods", "select=id,name,starts_on,ends_on,status,closed_at&order=starts_on.desc&limit=100");
  if (section === "reimbursement-forms") return getSupabaseRows("posted_forms", "select=id,title,status,form_kind,created_at,updated_at&form_kind=eq.reimbursement&order=updated_at.desc&limit=100");
  const workflows = {
    budgets: ["finance_budgets", "select=*&order=updated_at.desc&limit=100"],
    "purchase-requests": ["finance_purchase_requests", "select=*&order=updated_at.desc&limit=100"],
    reimbursements: ["finance_reimbursements", "select=*&order=updated_at.desc&limit=100"],
    collections: ["finance_collections", "select=*&order=updated_at.desc&limit=100"],
    reconciliation: ["finance_reconciliations", "select=*&order=updated_at.desc&limit=100"]
  };
  if (workflows[section]) return getSupabaseRows(...workflows[section]);
  if (section === "reports") return (await getSupabaseRows("finance_journal_entries", "select=id,reference_number,entry_type,status,entry_date,description,created_at&order=created_at.desc&limit=150")).map(toEntry);
  return [];
}

export async function getFinanceSectionData(section) {
  if (section === "accounts-funds") {
    const [accounts, funds, categories] = await Promise.all([getFinanceLeafData("accounts"), getFinanceLeafData("funds"), getFinanceLeafData("categories")]);
    return { accounts, funds, categories };
  }
  if (section === "reimbursements") {
    const [requests, forms] = await Promise.all([getFinanceLeafData("reimbursements"), getFinanceLeafData("reimbursement-forms")]);
    return { requests, forms };
  }
  if (section === "collections") {
    const [collections, income] = await Promise.all([getFinanceLeafData("collections"), getFinanceLeafData("reports")]);
    return { income: income.filter((row) => ["income", "collection"].includes(row.entryType) && row.status === "posted"), campaigns: collections, "charges-payments": collections };
  }
  if (section === "reconciliation-periods") {
    const [reconciliation, periods] = await Promise.all([getFinanceLeafData("reconciliation"), getFinanceLeafData("periods")]);
    return { reconciliation, periods };
  }
  return getFinanceLeafData(section);
}

export function createFinanceWorkflowRecord(section, form) {
  const userId = getCurrentSupabaseUserId();
  if (!userId) throw new Error("A signed-in Finance user is required.");
  if (section === "budgets") return insertSupabaseRow("finance_budgets", { name: form.title.trim(), fiscal_year: Number(form.date.slice(0, 4)), created_by: userId });
  if (section === "purchase-requests") return insertSupabaseRow("finance_purchase_requests", { title: form.title.trim(), amount: Number(form.amount), needed_by: form.date, created_by: userId });
  if (section === "reimbursements") return insertSupabaseRow("finance_reimbursements", { claimant_id: userId, description: form.title.trim(), amount: Number(form.amount), expense_date: form.date, created_by: userId });
  if (section === "collections") return insertSupabaseRow("finance_collections", { title: form.title.trim(), expected_amount: Number(form.amount), due_on: form.date, created_by: userId });
  throw new Error("This record requires its detailed Finance workflow.");
}

export function createFinanceTransaction(payload) {
  return callSupabaseRpc("create_finance_journal_entry", {
    requested_entry_type: payload.entryType,
    requested_entry_date: payload.entryDate,
    requested_description: payload.description,
    requested_lines: payload.lines,
    requested_source_type: payload.sourceType ?? null,
    requested_source_id: payload.sourceId ?? null,
    requested_idempotency_key: payload.idempotencyKey ?? crypto.randomUUID()
  });
}

export function postFinanceTransaction(entryId, reason) {
  return callSupabaseRpc("post_finance_journal_entry", { target_entry_id: entryId, reason });
}

export function reverseFinanceTransaction(entryId, reason) {
  return callSupabaseRpc("reverse_finance_journal_entry", { target_entry_id: entryId, reason });
}

export function getFinanceLedgerAccounts() {
  return getSupabaseRows("finance_ledger_accounts", "select=id,code,name,account_class,is_active&is_active=eq.true&order=code.asc");
}

export function getFinanceTransactionLines(entryId) {
  return getSupabaseRows("finance_journal_lines", `select=id,ledger_account_id,direction,amount,currency,memo&journal_entry_id=eq.${encodeURIComponent(entryId)}&order=created_at.asc`);
}

export function manageFinanceRecord(entity, action, id, payload = {}) {
  return callSupabaseRpc("manage_finance_record", {
    target_entity: entity,
    requested_action: action,
    target_id: id,
    payload
  });
}

export function transitionFinanceWorkflow(targetType, targetId, targetStatus, reason = null) {
  return callSupabaseRpc("transition_finance_request", {
    target_type: targetType,
    target_id: targetId,
    target_status: targetStatus,
    reason
  });
}
