import { ClipboardList, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { asArray } from "../../utils/collections.js";
import { createStorageWorkflowRecord } from "./inventoryService.js";

const configs = {
  requests: ["Requests", "request", "Equipment and consumable requests from draft through handover."],
  loans: ["Loans & returns", "loan", "Borrower custody, due dates, partial returns, and condition checks."],
  restocking: ["Restocking", "restock request", "Reorder work created from shortages and approved demand."],
  suppliers: ["Suppliers & deliveries", "supplier", "Supplier records and incoming delivery inspection."],
  maintenance: ["Maintenance", "maintenance issue", "Repair, safety, assignment, and completion tracking."],
  audits: ["Stock audits", "audit", "Independent stock counts and discrepancy review."],
  reports: ["Storage reports", "report", "Permission-scoped inventory, custody, and safety summaries."],
  settings: ["Storage settings", "setting", "Workspace configuration managed by authorized users."]
};
const titleFor = (row) => row.title || row.name || row.issue || row.reference_number || "Untitled record";

export default function StorageWorkflowPanel({ section, rows = [], canCreate = false, onCreated }) {
  const [title, noun, description] = configs[section] ?? configs.reports;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", date: new Date(Date.now() + 86400000).toISOString().slice(0,10) });
  const [state, setState] = useState({ saving:false, error:"" });
  const sortedRows = useMemo(() => [...asArray(rows)].sort((a,b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at))), [rows]);
  const submit = async (event) => { event.preventDefault(); setState({saving:true,error:""}); try { await createStorageWorkflowRecord(section,form); setOpen(false); onCreated?.(); } catch(error){ setState({saving:false,error:error.message}); return; } setState({saving:false,error:""}); };
  return <section className="storage-workflow-view"><header className="storage-workflow-header"><div><span>Storage operations</span><h2>{title}</h2><p>{description}</p></div>{canCreate ? <button type="button" className="storage-primary-action" onClick={() => setOpen(true)}><Plus size={17}/>New {noun}</button>:null}</header>
    {sortedRows.length ? <div className="storage-workflow-list">{sortedRows.map((row)=><article key={row.id}><div className="storage-record-icon"><ClipboardList size={19}/></div><div><span>{row.reference_number || row.priority || "Operational record"}</span><h3>{titleFor(row)}</h3><p>{row.purpose || row.notes || "No additional notes."}</p></div><span className={`storage-status ${row.status || "draft"}`}>{String(row.status || "draft").replaceAll("_"," ")}</span></article>)}</div>:<div className="storage-workflow-empty"><ClipboardList size={28}/><h3>No {title.toLowerCase()} yet</h3><p>Records will appear here as the Storage team works through them.</p></div>}
    {open ? <div className="storage-dialog-layer" onMouseDown={(event)=>event.target===event.currentTarget&&setOpen(false)}><form className="storage-dialog" onSubmit={submit}><header><div><span>Create traceably</span><h2>New {noun}</h2></div><button type="button" aria-label="Close" onClick={()=>setOpen(false)}><X size={19}/></button></header><label>Title<input value={form.title} onChange={(event)=>setForm({...form,title:event.target.value})} required/></label><label>Needed or due date<input type="date" value={form.date} onChange={(event)=>setForm({...form,date:event.target.value})} required/></label>{state.error?<p className="storage-form-error" role="alert">{state.error}</p>:null}<footer><button type="button" onClick={()=>setOpen(false)}>Cancel</button><button type="submit" className="storage-primary-action" disabled={state.saving}>{state.saving?"Saving...":"Save draft"}</button></footer></form></div>:null}
  </section>;
}
