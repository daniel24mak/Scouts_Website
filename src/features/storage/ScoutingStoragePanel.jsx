import { Boxes, CalendarClock, ClipboardList, PackageCheck, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getScoutingStorageSelfService, submitScoutingStorageRequest } from "../../services/scoutingServices.js";

const tabs = [
  ["browse", "Browse Items", Boxes],
  ["requests", "My Requests", ClipboardList],
  ["loans", "Current Loans", PackageCheck]
];

const emptyRequest = { itemId: "", quantity: 1, title: "", purpose: "", neededFrom: "", neededUntil: "" };
const dateLabel = (value) => value ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value)) : "Not set";
const itemNames = (items) => (Array.isArray(items) ? items : []).map((item) => `${item.name} × ${item.quantity}`).join(", ");

export default function ScoutingStoragePanel({ canRequest = false, setSaveMessage }) {
  const [activeTab, setActiveTab] = useState("browse");
  const [state, setState] = useState({ loading: true, error: "", data: { items: [], requests: [], loans: [] } });
  const [requestOpen, setRequestOpen] = useState(false);
  const [request, setRequest] = useState(emptyRequest);
  const [saving, setSaving] = useState(false);
  const rows = useMemo(() => state.data[activeTab === "browse" ? "items" : activeTab] ?? [], [activeTab, state.data]);

  const reload = async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try { setState({ loading: false, error: "", data: await getScoutingStorageSelfService() }); }
    catch (error) { setState((current) => ({ ...current, loading: false, error: error.message })); }
  };
  useEffect(() => { reload(); }, []);

  const submitRequest = async (event) => {
    event.preventDefault();
    if (!request.itemId || !request.title.trim() || !request.neededFrom || Number(request.quantity) < 1) return;
    setSaving(true);
    try {
      await submitScoutingStorageRequest({ ...request, title: request.title.trim(), purpose: request.purpose.trim() });
      setRequest(emptyRequest);
      setRequestOpen(false); setActiveTab("requests"); setSaveMessage?.("Storage request submitted.");
      await reload();
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally { setSaving(false); }
  };

  const openRequest = (item) => {
    setRequest((current) => ({ ...current, itemId: item?.id ?? current.itemId, title: item ? `Request ${item.name}` : current.title }));
    setRequestOpen(true);
  };

  return <div className="scouting-service-page">
    <div className="forms-section-tabs" role="tablist" aria-label="Storage sections">
      {tabs.map(([key, label, Icon]) => <button type="button" role="tab" aria-selected={activeTab === key} className={activeTab === key ? "active" : ""} key={key} onClick={() => setActiveTab(key)}><Icon size={17} />{label}</button>)}
    </div>
    {canRequest && <div className="scouting-service-actions"><button type="button" className="primary-action" onClick={() => requestOpen ? setRequestOpen(false) : openRequest()}><Plus size={17} />New request</button></div>}
    {requestOpen && <form className="admin-panel scouting-storage-request" onSubmit={submitRequest}>
      <h2>Request equipment</h2>
      <div className="inline-editor-grid"><label>Item<select value={request.itemId} onChange={(event) => setRequest((value) => ({ ...value, itemId: event.target.value }))} required><option value="">Choose an available item</option>{state.data.items.filter((item) => Number(item.available_quantity) > 0).map((item) => <option value={item.id} key={item.id}>{item.name} ({Number(item.available_quantity)} available)</option>)}</select></label><label>Quantity<input type="number" min="1" step="1" value={request.quantity} onChange={(event) => setRequest((value) => ({ ...value, quantity: event.target.value }))} required /></label></div>
      <label>Request title<input value={request.title} onChange={(event) => setRequest((value) => ({ ...value, title: event.target.value }))} required /></label>
      <label>Purpose<textarea value={request.purpose} onChange={(event) => setRequest((value) => ({ ...value, purpose: event.target.value }))} /></label>
      <div className="inline-editor-grid"><label>Needed from<input type="date" value={request.neededFrom} onChange={(event) => setRequest((value) => ({ ...value, neededFrom: event.target.value }))} required /></label><label>Needed until<input type="date" min={request.neededFrom} value={request.neededUntil} onChange={(event) => setRequest((value) => ({ ...value, neededUntil: event.target.value }))} /></label></div>
      <button type="submit" className="primary-action" disabled={saving}>{saving ? "Submitting..." : "Submit request"}</button>
    </form>}
    {state.loading ? <article className="admin-panel empty-approval-preview"><div className="dashboard-inline-loader" /><h3>Loading Storage</h3><p>Retrieving the items and requests available to you.</p></article> : null}
    {!state.loading && state.error ? <article className="admin-panel empty-approval-preview"><h3>Storage could not be loaded</h3><p>{state.error}</p><button type="button" className="inline-action" onClick={reload}>Try again</button></article> : null}
    {!state.loading && !state.error && <div className="scouting-storage-grid">{rows.length ? rows.map((row) => <article className="admin-panel scouting-storage-card" key={row.id}>
      <div className="scouting-storage-card-heading"><div><span>{row.category_name ?? row.sku ?? row.reference_number ?? "Storage"}</span><h3>{row.name ?? row.title ?? "Equipment loan"}</h3></div><small className={`forms-status-pill ${row.status ?? "available"}`}>{String(row.status ?? (Number(row.available_quantity) > 0 ? "available" : "unavailable")).replaceAll("_", " ")}</small></div>
      {activeTab === "browse" ? <><p>{row.description || `${row.item_kind} · ${row.unit_name}`}</p><dl className="scouting-storage-metrics"><div><dt>Total</dt><dd>{Number(row.total_quantity || 0)}</dd></div><div><dt>Available</dt><dd>{Number(row.available_quantity || 0)}</dd></div><div><dt>Borrowed</dt><dd>{Number(row.borrowed_quantity || 0)}</dd></div><div><dt>Reserved</dt><dd>{Number(row.reserved_quantity || 0)}</dd></div></dl>{row.next_available_at ? <span className="scouting-storage-date"><CalendarClock size={15} />Next expected {dateLabel(row.next_available_at)}</span> : null}{canRequest && Number(row.available_quantity) > 0 ? <button type="button" className="inline-action" onClick={() => openRequest(row)}>Request item</button> : null}</> : activeTab === "requests" ? <><p>{row.purpose || "No purpose supplied."}</p><strong>{itemNames(row.items) || "Request details pending"}</strong><span className="scouting-storage-date"><CalendarClock size={15} />Needed {dateLabel(row.needed_from)}{row.needed_until ? ` to ${dateLabel(row.needed_until)}` : ""}</span></> : <><strong>{itemNames(row.items) || "Loan items"}</strong><p>{row.notes || "Keep equipment in the recorded condition and return it by the due date."}</p><span className="scouting-storage-date"><CalendarClock size={15} />Due {dateLabel(row.due_at)}</span></>}
    </article>) : <article className="admin-panel empty-approval-preview"><PackageCheck size={28} /><h3>Nothing here yet</h3><p>{activeTab === "browse" ? "No available inventory is visible." : activeTab === "requests" ? "Your equipment requests will appear here." : "You have no current equipment loans."}</p></article>}</div>}
  </div>;
}
