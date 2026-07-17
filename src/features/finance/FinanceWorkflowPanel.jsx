import { CircleDollarSign, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { asArray } from "../../utils/collections.js";
import { createFinanceWorkflowRecord } from "./financeService.js";

const configs = {
  budgets: ["Budgets", "budget", "Versioned spending plans and approval status.", null],
  "purchase-requests": ["Purchase requests", "purchase request", "Requests awaiting review, ordering, receipt, or payment.", "amount"],
  reimbursements: ["Reimbursements", "reimbursement", "Expense claims with a complete review and payment trail.", "amount"],
  collections: ["Collections", "collection", "Expected, collected, refunded, and waived amounts.", "expected_amount"],
  reconciliation: ["Reconciliation", "reconciliation", "Statement-to-ledger checks with independent review.", null],
  reports: ["Finance reports", "report", "Permission-scoped operational summaries.", null]
};
const labelFor = (row) => row.title || row.name || row.description || row.reference_number || "Untitled record";
const amount = (value) => new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED" }).format(Number(value || 0));

export default function FinanceWorkflowPanel({ section, rows = [], canCreate = false, onCreated }) {
  const [title, noun, description, amountKey] = configs[section] ?? configs.reports;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", amount: "", date: new Date().toISOString().slice(0, 10) });
  const [state, setState] = useState({ saving: false, error: "" });
  const sortedRows = useMemo(() => [...asArray(rows)].sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at))), [rows]);
  const submit = async (event) => {
    event.preventDefault(); setState({ saving: true, error: "" });
    try { await createFinanceWorkflowRecord(section, form); setOpen(false); onCreated?.(); }
    catch (error) { setState({ saving: false, error: error.message }); return; }
    setState({ saving: false, error: "" });
  };
  return <section className="finance-workflow-view">
    <header className="finance-workflow-header"><div><span>Finance operations</span><h2>{title}</h2><p>{description}</p></div>{canCreate ? <button type="button" className="finance-primary-action" onClick={() => setOpen(true)}><Plus size={17}/>New {noun}</button> : null}</header>
    {sortedRows.length ? <div className="finance-workflow-list">{sortedRows.map((row) => <article key={row.id}><div className="finance-record-icon"><CircleDollarSign size={19}/></div><div><span>{row.reference_number || row.fiscal_year || "Draft"}</span><h3>{labelFor(row)}</h3><p>{row.notes || row.purpose || "No additional notes."}</p></div>{amountKey ? <strong>{amount(row[amountKey])}</strong> : null}<span className={`finance-status ${row.status || "draft"}`}>{String(row.status || "draft").replaceAll("_", " ")}</span></article>)}</div> : <div className="finance-workflow-empty"><CircleDollarSign size={28}/><h3>No {title.toLowerCase()} yet</h3><p>Records will appear here as the Finance team creates and reviews them.</p></div>}
    {open ? <div className="finance-dialog-layer" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}><form className="finance-dialog" onSubmit={submit}><header><div><span>Create securely</span><h2>New {noun}</h2></div><button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={19}/></button></header><label>Title<input value={form.title} onChange={(event) => setForm({...form,title:event.target.value})} required/></label>{amountKey ? <label>Amount (AED)<input type="number" min="0.01" step="0.01" inputMode="decimal" value={form.amount} onChange={(event) => setForm({...form,amount:event.target.value})} required/></label> : null}<label>Relevant date<input type="date" value={form.date} onChange={(event) => setForm({...form,date:event.target.value})} required/></label>{state.error ? <p className="finance-form-error" role="alert">{state.error}</p> : null}<footer><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="finance-primary-action" disabled={state.saving}>{state.saving ? "Saving..." : "Save draft"}</button></footer></form></div> : null}
  </section>;
}
