import {
  BarChart3, Banknote, BookOpenCheck, Building2, ClipboardCheck, FileBarChart2, HandCoins,
  Landmark, LayoutDashboard, PiggyBank, ReceiptText, RefreshCcw, Settings2, WalletCards
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import FocusedWorkspaceShell from "../../workspaces/FocusedWorkspaceShell.jsx";
import { asArray } from "../../utils/collections.js";
import { FINANCE_NAVIGATION, formatFinanceAmount, getFinancePermissionKeys, getVisibleFinanceNavigation } from "./financeModel.js";
import { getFinanceOverview, getFinanceSectionData } from "./financeService.js";
import FinanceWorkflowPanel from "./FinanceWorkflowPanel.jsx";
import "./financeWorkspace.css";

const icons = {
  overview: LayoutDashboard, transactions: ReceiptText, accounts: Landmark, funds: PiggyBank,
  budgets: BarChart3, "purchase-requests": ClipboardCheck, reimbursements: HandCoins,
  collections: Banknote, reconciliation: RefreshCcw, periods: BookOpenCheck,
  reports: FileBarChart2, settings: Settings2
};

function FinanceState({ title, children, action }) {
  return <section className="finance-state"><WalletCards size={28} aria-hidden="true" /><h2>{title}</h2>{children}{action}</section>;
}

function Overview({ data }) {
  const overview = data && typeof data === "object" ? data : {};
  const recentTransactions = asArray(overview.recentTransactions);
  const actionItems = asArray(overview.actionItems);
  const cards = [
    ["Available balance", formatFinanceAmount(overview.totalBalance)],
    ["Income this month", formatFinanceAmount(overview.currentMonthIncome)],
    ["Expenses this month", formatFinanceAmount(overview.currentMonthExpenses)],
    ["Needs reconciliation", overview.accountsNeedingReconciliation ?? 0]
  ];
  return <>
    <div className="finance-summary-grid">{cards.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
    <div className="finance-overview-grid">
      <section className="finance-panel"><header><div><span>Ledger activity</span><h2>Recent transactions</h2></div><ReceiptText size={20} /></header>{recentTransactions.length ? <TransactionTable rows={recentTransactions} /> : <p className="finance-empty-copy">Posted and draft transactions will appear here.</p>}</section>
      <section className="finance-panel"><header><div><span>Attention</span><h2>Finance actions</h2></div><ClipboardCheck size={20} /></header>{actionItems.length ? actionItems.map((item) => <button type="button" key={item.id}>{item.title}</button>) : <p className="finance-empty-copy">No urgent Finance actions right now.</p>}</section>
    </div>
  </>;
}

function TransactionTable({ rows }) {
  return <div className="finance-table-wrap"><table><thead><tr><th>Reference</th><th>Date</th><th>Description</th><th>Type</th><th>Status</th></tr></thead><tbody>{asArray(rows).map((row) => <tr key={row.id}><td>{row.referenceNumber ?? "Draft"}</td><td>{row.entryDate}</td><td>{row.description}</td><td>{row.entryType}</td><td><span className={`finance-status ${row.status ?? "draft"}`}>{String(row.status ?? "draft").replaceAll("_", " ")}</span></td></tr>)}</tbody></table></div>;
}

function SectionData({ section, rows }) {
  const safeRows = asArray(rows);
  if (section === "transactions") return <section className="finance-panel"><h2>Transactions</h2>{safeRows.length ? <TransactionTable rows={safeRows} /> : <p className="finance-empty-copy">No transactions have been recorded.</p>}</section>;
  if (section === "accounts") return <div className="finance-record-grid">{safeRows.map((account) => <article className="finance-panel" key={account.id}><Building2 size={21} /><div><span>{String(account.accountType ?? "account").replaceAll("_", " ")}</span><h2>{account.name}</h2></div><strong>{formatFinanceAmount(account.calculatedBalance, account.currency)}</strong><small>{String(account.reconciliationStatus ?? "pending").replaceAll("_", " ")}</small></article>)}</div>;
  if (section === "funds") return <div className="finance-record-grid">{safeRows.map((fund) => <article className="finance-panel" key={fund.id}><PiggyBank size={21} /><div><span>{fund.code}</span><h2>{fund.name}</h2><p>{fund.description || "No description"}</p></div>{fund.is_restricted ? <small>Restricted</small> : <small>General</small>}</article>)}</div>;
  if (section === "periods") return <div className="finance-record-grid">{safeRows.map((period) => <article className="finance-panel" key={period.id}><BookOpenCheck size={21} /><div><span>{period.status}</span><h2>{period.name}</h2><p>{period.starts_on} to {period.ends_on}</p></div></article>)}</div>;
  return <FinanceWorkflowPanel section={section} rows={safeRows} canCreate={["budgets", "purchase-requests", "reimbursements", "collections"].includes(section)} onCreated={() => window.location.reload()} />;
}

export default function FinanceWorkspace({ section = "overview", effectiveAccess, availableWorkspaces, onWorkspaceChange, onSectionChange }) {
  const permissionKeys = useMemo(() => getFinancePermissionKeys(effectiveAccess), [effectiveAccess]);
  const navigation = useMemo(() => getVisibleFinanceNavigation(permissionKeys).map((item) => ({ ...item, Icon: icons[item.key] })), [permissionKeys]);
  const activeSection = navigation.some((item) => item.key === section) ? section : "overview";
  const [state, setState] = useState({ loading: true, error: "", data: null });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: "", data: null });
    const request = activeSection === "overview" ? getFinanceOverview() : getFinanceSectionData(activeSection);
    request.then((data) => { if (!cancelled) setState({ loading: false, error: "", data }); })
      .catch((error) => { if (!cancelled) setState({ loading: false, error: error.message, data: null }); });
    return () => { cancelled = true; };
  }, [activeSection]);

  return <FocusedWorkspaceShell workspaceKey="finance" workspaceLabel="Finance" workspaceIcon={WalletCards} workspaces={availableWorkspaces} onWorkspaceChange={onWorkspaceChange} navigation={navigation} activeSection={activeSection} onSectionChange={onSectionChange}>
    <div className="finance-page-heading"><div><span>Finance workspace</span><h1>{navigation.find((item) => item.key === activeSection)?.label ?? "Overview"}</h1><p>Secure accounting, approvals, collections, and financial oversight.</p></div></div>
    {state.loading ? <FinanceState title="Loading Finance data"><p>Retrieving only the records you are permitted to view.</p><div className="finance-loading-bar" /></FinanceState> : null}
    {!state.loading && state.error ? <FinanceState title="Finance data could not be loaded" action={<button type="button" onClick={() => window.location.reload()}>Reload workspace</button>}><p>{state.error.includes("PGRST") || state.error.includes("schema cache") ? "Apply the Finance migrations in Supabase, then reload this workspace." : state.error}</p></FinanceState> : null}
    {!state.loading && !state.error && activeSection === "overview" ? <Overview data={state.data} /> : null}
    {!state.loading && !state.error && activeSection !== "overview" ? <SectionData section={activeSection} rows={state.data ?? []} /> : null}
  </FocusedWorkspaceShell>;
}
