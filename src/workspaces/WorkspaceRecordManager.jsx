import { Archive, Edit3, Plus, RotateCcw, X } from "lucide-react";
import { useMemo, useState } from "react";

const initialValues = (fields, record = null) => Object.fromEntries(fields.map((field) => [field.key, record?.[field.key] ?? field.defaultValue ?? (field.type === "checkbox" ? false : "")]));

export default function WorkspaceRecordManager({ title, noun, rows, fields, onMutate, renderRecord, canManage = true }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => initialValues(fields));
  const [state, setState] = useState({ saving: false, error: "" });
  const visibleRows = useMemo(() => [...safeRows].sort((a, b) => String(a.name ?? a.title ?? a.code).localeCompare(String(b.name ?? b.title ?? b.code))), [safeRows]);

  const open = (record = null) => { setEditing(record ?? {}); setForm(initialValues(fields, record)); setState({ saving: false, error: "" }); };
  const close = () => { if (!state.saving) setEditing(null); };
  const mutate = async (action, record = editing, values = form) => {
    setState({ saving: true, error: "" });
    try { await onMutate(action, record?.id ?? null, values); setEditing(null); }
    catch (error) { setState({ saving: false, error: error.message }); return; }
    setState({ saving: false, error: "" });
  };

  return <section className="workspace-manager">
    <header><div><span>Workspace records</span><h2>{title}</h2></div>{canManage ? <button type="button" className="workspace-primary-action" onClick={() => open()}><Plus size={17} />Add {noun}</button> : null}</header>
    {visibleRows.length ? <div className="workspace-manager-list">{visibleRows.map((record) => <article key={record.id}>{renderRecord(record)}{canManage ? <div className="workspace-record-actions"><button type="button" onClick={() => open(record)} title={`Edit ${noun}`}><Edit3 size={16} /></button><button type="button" onClick={() => mutate(record.is_active === false || record.retired_at ? "restore" : "archive", record, {})} title={record.is_active === false || record.retired_at ? "Restore" : "Archive"}>{record.is_active === false || record.retired_at ? <RotateCcw size={16} /> : <Archive size={16} />}</button></div> : null}</article>)}</div> : <div className="workspace-manager-empty"><p>No {title.toLowerCase()} yet.</p>{canManage ? <button type="button" onClick={() => open()}>Add the first {noun}</button> : null}</div>}
    {editing ? <div className="workspace-manager-layer" onMouseDown={(event) => event.target === event.currentTarget && close()}><form className="workspace-manager-dialog" onSubmit={(event) => { event.preventDefault(); mutate(editing.id ? "update" : "create"); }}><header><div><span>{editing.id ? "Edit record" : "Create record"}</span><h2>{editing.id ? `Edit ${noun}` : `New ${noun}`}</h2></div><button type="button" onClick={close} aria-label="Close"><X size={19} /></button></header><div className="workspace-manager-fields">{fields.map((field) => <label key={field.key}>{field.label}{field.type === "select" ? <select value={form[field.key]} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} required={field.required}><option value="">Select {field.label.toLowerCase()}</option>{(field.options ?? []).map((option) => <option key={option.value ?? option} value={option.value ?? option}>{option.label ?? option}</option>)}</select> : field.type === "checkbox" ? <input type="checkbox" checked={Boolean(form[field.key])} onChange={(event) => setForm({ ...form, [field.key]: event.target.checked })} /> : <input type={field.type ?? "text"} value={form[field.key]} min={field.min} step={field.step} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} required={field.required} />}</label>)}</div>{state.error ? <p className="workspace-manager-error" role="alert">{state.error}</p> : null}<footer><button type="button" onClick={close}>Cancel</button><button type="submit" className="workspace-primary-action" disabled={state.saving}>{state.saving ? "Saving..." : editing.id ? "Save changes" : `Create ${noun}`}</button></footer></form></div> : null}
  </section>;
}
