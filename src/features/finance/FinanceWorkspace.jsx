import {
  BarChart3, Banknote, BookOpenCheck, Building2, ClipboardCheck, FileBarChart2, HandCoins,
  Landmark, LayoutDashboard, PiggyBank, ReceiptText, RefreshCcw, Settings2, Sparkles, WalletCards
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import FocusedWorkspaceShell from "../../workspaces/FocusedWorkspaceShell.jsx";
import WorkspaceAssistant from "../../workspaces/WorkspaceAssistant.jsx";
import WorkspaceRecordManager from "../../workspaces/WorkspaceRecordManager.jsx";
import WorkspaceTabs from "../../workspaces/WorkspaceTabs.jsx";
import { asArray } from "../../utils/collections.js";
import { FINANCE_NAVIGATION, FINANCE_SECTION_TABS, formatFinanceAmount, getFinancePermissionKeys, getVisibleFinanceNavigation } from "./financeModel.js";
import { getFinanceOverview, getFinanceSectionData, manageFinanceRecord } from "./financeService.js";
import FinanceWorkflowPanel from "./FinanceWorkflowPanel.jsx";
import FinanceTransactionManager from "./FinanceTransactionManager.jsx";
import "./financeWorkspace.css";

const icons = {
  overview: LayoutDashboard, aiAssistant: Sparkles, transactions: ReceiptText, "accounts-funds": Landmark,
  budgets: BarChart3, "purchase-requests": ClipboardCheck, reimbursements: HandCoins,
  collections: Banknote, "reconciliation-periods": RefreshCcw,
  reports: FileBarChart2, settings: Settings2
};

function FinanceState({ title, children, action }) {
  return <section className="finance-state"><WalletCards size={28} aria-hidden="true" /><h2>{title}</h2>{children}{action}</section>;
}

function Overview({ data }) {
  const overview = data && typeof data === "object" ? data : {};
  if (!overview.accountCount) {
    return <section className="finance-panel workspace-setup-panel"><header><div><span>Finance setup</span><h2>Prepare the Finance workspace</h2></div><Landmark size={20} /></header><p className="finance-empty-copy">Complete these once. The overview will then calculate live balances from posted ledger entries.</p><ol className="workspace-setup-list"><li>Create the first account</li><li>Record an opening balance as a balanced transaction</li><li>Create income and expense categories</li><li>Create the first budget</li></ol></section>;
  }
  const recentTransactions = asArray(overview.recentTransactions);
  const actionItems = asArray(overview.actionItems);
  const cards = [
    ["Available balance", formatFinanceAmount(overview.totalBalance)],
    ["Committed funds", formatFinanceAmount(overview.committedFunds)],
    ["Pending reimbursements", overview.pendingReimbursements ?? 0],
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

const financeFields = {
  accounts: [{ key: "name", label: "Account name", required: true }, { key: "code", label: "Ledger code", required: true }, { key: "account_type", label: "Account type", type: "select", required: true, options: ["bank","cashbox","petty_cash","event_cashbox","card","temporary"] }, { key: "currency", label: "Currency", defaultValue: "AED", required: true }, { key: "description", label: "Description" }],
  funds: [{ key: "code", label: "Code", required: true }, { key: "name", label: "Fund name", required: true }, { key: "description", label: "Description" }, { key: "is_restricted", label: "Restricted fund", type: "checkbox" }],
  categories: [{ key: "code", label: "Code", required: true }, { key: "name", label: "Category name", required: true }, { key: "category_type", label: "Category type", type: "select", required: true, options: ["income", "expense", "transfer", "adjustment"] }],
  periods: [{ key: "name", label: "Period name", required: true }, { key: "starts_on", label: "Starts on", type: "date", required: true }, { key: "ends_on", label: "Ends on", type: "date", required: true }]
};

function SectionData({ section, rows, canManage, permissions, onRefresh }) {
  const tabs = FINANCE_SECTION_TABS[section];
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.key ?? section);
  useEffect(() => setActiveTab(FINANCE_SECTION_TABS[section]?.[0]?.key ?? section), [section]);
  const sourceRows = tabs ? rows?.[activeTab] : rows;
  const safeRows = asArray(sourceRows);
  const leafSection = section === "accounts-funds" ? activeTab : section === "reconciliation-periods" ? activeTab : section === "reimbursements" && activeTab === "requests" ? "reimbursements" : section;
  const content = (() => {
  if (leafSection === "transactions" || (section === "collections" && activeTab === "income")) return <FinanceTransactionManager rows={safeRows} onRefresh={onRefresh} canCreate={leafSection === "transactions" && permissions.includes("finance.transactions.create")} canPost={permissions.includes("finance.transactions.post")} canReverse={permissions.includes("finance.transactions.reverse")} />;
  if (["accounts", "funds", "categories", "periods"].includes(leafSection)) {
    const entity = { accounts: "account", funds: "fund", categories: "category", periods: "period" }[leafSection];
    return <WorkspaceRecordManager title={{accounts:"Accounts",funds:"Funds",categories:"Categories",periods:"Accounting periods"}[leafSection]} noun={entity} rows={safeRows} fields={financeFields[leafSection]} canManage={canManage} onMutate={async (action,id,payload) => { await manageFinanceRecord(entity,action,id,payload); await onRefresh(); }} renderRecord={(record) => <><div>{leafSection === "accounts" ? <Building2 size={21}/> : leafSection === "funds" ? <PiggyBank size={21}/> : <BookOpenCheck size={21}/>}</div><div><small>{record.code || record.category_type || record.account_type || record.status}</small><h3>{record.name}</h3><p>{record.description || (leafSection === "periods" ? `${record.starts_on} to ${record.ends_on}` : "No description")}</p></div>{leafSection === "accounts" ? <strong>{formatFinanceAmount(record.calculatedBalance,record.currency)}</strong> : null}</>} />;
  }
  if (section === "reimbursements" && activeTab === "forms") return <FinanceWorkflowPanel section="reimbursements" rows={safeRows} canCreate={false} onCreated={onRefresh} />;
  return <FinanceWorkflowPanel section={section === "collections" ? "collections" : leafSection} rows={safeRows} canCreate={["budgets", "purchase-requests", "reimbursements", "collections"].includes(leafSection) || (section === "collections" && activeTab === "campaigns")} canApprove={permissions.includes(leafSection === "purchase-requests" ? "finance.purchases.approve" : "finance.reimbursements.approve")} canPost={permissions.includes("finance.transactions.post")} onCreated={onRefresh} />;
  })();
  return <>{tabs ? <WorkspaceTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} label={`${section} views`} /> : null}{content}</>;
}

export default function FinanceWorkspace({ section = "overview", effectiveAccess, availableWorkspaces, onWorkspaceChange, onSectionChange }) {
  const permissionKeys = useMemo(() => getFinancePermissionKeys(effectiveAccess), [effectiveAccess]);
  const navigation = useMemo(() => getVisibleFinanceNavigation(permissionKeys).map((item) => ({ ...item, Icon: icons[item.key] })), [permissionKeys]);
  const activeSection = navigation.some((item) => item.key === section) ? section : "overview";
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [reloadToken, setReloadToken] = useState(0);
  const refreshSection = async () => setReloadToken((value) => value + 1);

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: "", data: null });
    const request = activeSection === "overview" ? getFinanceOverview() : getFinanceSectionData(activeSection);
    request.then((data) => { if (!cancelled) setState({ loading: false, error: "", data }); })
      .catch((error) => { if (!cancelled) setState({ loading: false, error: error.message, data: null }); });
    return () => { cancelled = true; };
  }, [activeSection, reloadToken]);

  const canManageCatalog = permissionKeys.includes("finance.settings.manage");

  return <FocusedWorkspaceShell workspaceKey="finance" workspaceLabel="Finance" workspaceIcon={WalletCards} workspaces={availableWorkspaces} onWorkspaceChange={onWorkspaceChange} navigation={navigation} activeSection={activeSection} onSectionChange={onSectionChange}>
    <div className="finance-page-heading"><div><span>Finance workspace</span><h1>{navigation.find((item) => item.key === activeSection)?.label ?? "Overview"}</h1><p>Secure accounting, approvals, collections, and financial oversight.</p></div></div>
    {state.loading ? <FinanceState title="Loading Finance data"><p>Retrieving only the records you are permitted to view.</p><div className="finance-loading-bar" /></FinanceState> : null}
    {!state.loading && state.error ? <FinanceState title="Finance data could not be loaded" action={<button type="button" onClick={() => window.location.reload()}>Reload workspace</button>}><p>{state.error.includes("PGRST") || state.error.includes("schema cache") ? "Apply the Finance migrations in Supabase, then reload this workspace." : state.error}</p></FinanceState> : null}
    {!state.loading && !state.error && activeSection === "overview" ? <Overview data={state.data} /> : null}
    {!state.loading && !state.error && activeSection === "aiAssistant" ? <WorkspaceAssistant workspaceLabel="Finance" /> : null}
    {!state.loading && !state.error && !["overview","aiAssistant"].includes(activeSection) ? <SectionData section={activeSection} rows={state.data ?? []} canManage={canManageCatalog} permissions={permissionKeys} onRefresh={refreshSection} /> : null}
  </FocusedWorkspaceShell>;
}
