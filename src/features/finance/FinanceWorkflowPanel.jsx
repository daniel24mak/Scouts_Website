import { CircleDollarSign, Edit3, Play, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { asArray } from "../../utils/collections.js";
import { createFinanceWorkflowRecord, manageFinanceRecord, transitionFinanceWorkflow } from "./financeService.js";

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

export default function FinanceWorkflowPanel({ section, rows = [], canCreate = false, canApprove = false, canPost = false, onCreated }) {
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
  const editCollection = (row) => { setForm({ title: row.title ?? "", amount: row.expected_amount ?? "", date: row.due_on ?? new Date().toISOString().slice(0, 10), id: row.id }); setOpen(true); };
  const saveCollection = async (event) => {
    event.preventDefault(); setState({ saving: true, error: "" });
    try {
      if (form.id) await manageFinanceRecord("collection", "update", form.id, { title: form.title, expected_amount: form.amount, due_on: form.date });
      else await createFinanceWorkflowRecord(section, form);
      setOpen(false); setForm({ title: "", amount: "", date: new Date().toISOString().slice(0, 10) }); await onCreated?.();
    } catch (error) { setState({ saving: false, error: error.message }); return; }
    setState({ saving: false, error: "" });
  };
  const collectionAction = async (row, action, payload = {}) => { setState({ saving: true, error: "" }); try { await manageFinanceRecord("collection", action, row.id, payload); await onCreated?.(); } catch (error) { setState({ saving: false, error: error.message }); return; } setState({ saving: false, error: "" }); };
  const transition = async (row, status) => { const reason = ["changes_requested", "rejected"].includes(status) ? window.prompt("Reason for this decision") : null; if (["changes_requested", "rejected"].includes(status) && !reason?.trim()) return; setState({ saving: true, error: "" }); try { await transitionFinanceWorkflow(section === "purchase-requests" ? "purchase_request" : section === "reimbursements" ? "reimbursement" : "reconciliation", row.id, status, reason); await onCreated?.(); } catch (error) { setState({ saving: false, error: error.message }); return; } setState({ saving: false, error: "" }); };
  return <section className="finance-workflow-view">
    <header className="finance-workflow-header"><div><span>Finance operations</span><h2>{title}</h2><p>{description}</p></div>{canCreate ? <button type="button" className="finance-primary-action" onClick={() => setOpen(true)}><Plus size={17}/>New {noun}</button> : null}</header>
    {state.error ? <p className="finance-form-error" role="alert">{state.error}</p> : null}
    {sortedRows.length ? <div className="finance-workflow-list">{sortedRows.map((row) => <article key={row.id}><div className="finance-record-icon"><CircleDollarSign size={19}/></div><div><span>{row.reference_number || row.fiscal_year || "Draft"}</span><h3>{labelFor(row)}</h3><p>{row.notes || row.purpose || "No additional notes."}</p></div>{amountKey ? <strong>{amount(row[amountKey])}</strong> : null}<span className={`finance-status ${row.status || "draft"}`}>{String(row.status || "draft").replaceAll("_", " ")}</span>{["purchase-requests", "reimbursements"].includes(section) && ["draft", "changes_requested"].includes(row.status) ? <div className="finance-row-actions"><button type="button" onClick={() => transition(row, "pending_approval")}>Submit</button></div> : null}{["purchase-requests", "reimbursements"].includes(section) && canApprove && row.status === "pending_approval" ? <div className="finance-row-actions"><button type="button" onClick={() => transition(row, "approved")}>Approve</button><button type="button" onClick={() => transition(row, "changes_requested")}>Changes</button><button type="button" onClick={() => transition(row, "rejected")}>Reject</button></div> : null}{section === "reimbursements" && canPost && ["approved", "scheduled"].includes(row.status) ? <div className="finance-row-actions"><button type="button" onClick={() => transition(row, "paid")}>Mark paid</button></div> : null}{section === "collections" && row.status === "draft" ? <div className="finance-row-actions"><button type="button" title="Edit collection" onClick={() => editCollection(row)}><Edit3 size={16}/></button><button type="button" title="Open collection" onClick={() => collectionAction(row, "transition", { status: "open" })}><Play size={16}/></button><button type="button" title="Delete draft" onClick={() => collectionAction(row, "delete")}><Trash2 size={16}/></button></div> : null}{section === "collections" && ["open", "partially_collected"].includes(row.status) ? <div className="finance-row-actions"><button type="button" onClick={() => collectionAction(row, "transition", { status: "cancelled" })}>Cancel</button></div> : null}</article>)}</div> : <div className="finance-workflow-empty"><CircleDollarSign size={28}/><h3>No {title.toLowerCase()} yet</h3><p>Records will appear here as the Finance team creates and reviews them.</p></div>}
    {open ? <div className="finance-dialog-layer" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}><form className="finance-dialog" onSubmit={section === "collections" ? saveCollection : submit}><header><div><span>{form.id ? "Edit safely" : "Create securely"}</span><h2>{form.id ? `Edit ${noun}` : `New ${noun}`}</h2></div><button type="button" aria-label="Close" onClick={() => setOpen(false)}><X size={19}/></button></header><label>Title<input value={form.title} onChange={(event) => setForm({...form,title:event.target.value})} required/></label>{amountKey ? <label>Amount (AED)<input type="number" min="0.01" step="0.01" inputMode="decimal" value={form.amount} onChange={(event) => setForm({...form,amount:event.target.value})} required/></label> : null}<label>Relevant date<input type="date" value={form.date} onChange={(event) => setForm({...form,date:event.target.value})} required/></label>{state.error ? <p className="finance-form-error" role="alert">{state.error}</p> : null}<footer><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="finance-primary-action" disabled={state.saving}>{state.saving ? "Saving..." : form.id ? "Save changes" : "Save draft"}</button></footer></form></div> : null}
  </section>;
}
