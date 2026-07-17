import { Archive, Boxes, ClipboardCheck, ClipboardList, FileBarChart2, Forklift, History, LayoutDashboard, MapPin, PackageCheck, PackageOpen, RefreshCcw, Settings2, ShieldCheck, Truck, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import FocusedWorkspaceShell from "../../workspaces/FocusedWorkspaceShell.jsx";
import { asArray } from "../../utils/collections.js";
import { getStorageOverview, getStorageSectionData } from "./inventoryService.js";
import { getStoragePermissionKeys, getVisibleStorageNavigation, STORAGE_NAVIGATION } from "./storageModel.js";
import StorageWorkflowPanel from "./StorageWorkflowPanel.jsx";
import "./storageWorkspace.css";

const icons = { overview: LayoutDashboard, inventory: Boxes, assets: Archive, kits: PackageCheck, requests: ClipboardList, loans: PackageOpen, locations: MapPin, movements: History, restocking: RefreshCcw, suppliers: Truck, maintenance: Wrench, audits: ClipboardCheck, reports: FileBarChart2, settings: Settings2 };
const humanize = (value) => String(value ?? "").replaceAll("_", " ");

function StorageState({ title, children, action }) { return <section className="storage-state"><Forklift size={29} aria-hidden="true" /><h2>{title}</h2>{children}{action}</section>; }
function Status({ value }) { return <span className={`storage-status ${String(value).replaceAll("_", "-")}`}>{humanize(value)}</span>; }
function MovementTable({ rows }) { return <div className="storage-table-wrap"><table><thead><tr><th>Reference</th><th>Date</th><th>Movement</th><th>Quantity</th><th>Status</th></tr></thead><tbody>{asArray(rows).map((row) => <tr key={row.id}><td>{row.reference_number ?? "Pending"}</td><td>{new Date(row.created_at).toLocaleDateString("en-AE")}</td><td>{humanize(row.movement_type)}</td><td>{Number(row.quantity).toLocaleString("en-AE")}</td><td><Status value={row.status} /></td></tr>)}</tbody></table></div>; }

function Overview({ data }) {
  const overview = data && typeof data === "object" ? data : {};
  const recentMovements = asArray(overview.recentMovements);
  const actionItems = asArray(overview.actionItems);
  const cards = [["Inventory items", overview.itemCount ?? 0], ["Tracked assets", overview.assetCount ?? 0], ["Below reorder level", overview.lowStockCount ?? 0], ["Unsafe assets", overview.unsafeAssetCount ?? 0]];
  return <><div className="storage-summary-grid">{cards.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><div className="storage-overview-grid"><section className="storage-panel"><header><div><span>Traceability</span><h2>Recent stock movements</h2></div><History size={20} /></header>{recentMovements.length ? <MovementTable rows={recentMovements} /> : <p className="storage-empty-copy">Receipts, issues, transfers, and returns will appear here.</p>}</section><section className="storage-panel"><header><div><span>Attention</span><h2>Storage actions</h2></div><ShieldCheck size={20} /></header>{actionItems.length ? actionItems.map((item) => <button type="button" key={item.id}>{item.title}</button>) : <p className="storage-empty-copy">No urgent Storage actions right now.</p>}</section></div></>;
}

function SectionData({ section, rows }) {
  const safeRows = asArray(rows);
  if (section === "movements") return <section className="storage-panel"><h2>Stock movements</h2>{safeRows.length ? <MovementTable rows={safeRows} /> : <p className="storage-empty-copy">No movements have been recorded.</p>}</section>;
  if (section === "inventory") return <div className="storage-record-grid">{safeRows.map((item) => <article className="storage-panel" key={item.id}><Boxes size={21} /><div><span>{item.sku} · {humanize(item.item_kind)}</span><h2>{item.name}</h2><p>{Number(item.available_quantity).toLocaleString("en-AE")} {item.unit_name} available</p></div><Status value={item.below_reorder_level ? "reorder" : item.safety_status} /></article>)}</div>;
  if (section === "assets") return <div className="storage-record-grid">{safeRows.map((asset) => <article className="storage-panel" key={asset.id}><Archive size={21} /><div><span>{asset.asset_tag}</span><h2>{asset.serial_number || "Tracked asset"}</h2></div><Status value={asset.condition} /><small>{humanize(asset.status)}</small></article>)}</div>;
  if (section === "kits") return <div className="storage-record-grid">{safeRows.map((kit) => <article className="storage-panel" key={kit.id}><PackageCheck size={21} /><div><span>{kit.code}</span><h2>{kit.name}</h2><p>{kit.description || "No description"}</p></div></article>)}</div>;
  if (section === "locations") return <div className="storage-record-grid">{safeRows.map((location) => <article className="storage-panel" key={location.id}><MapPin size={21} /><div><span>{location.code} · {humanize(location.location_type)}</span><h2>{location.name}</h2></div><small>{location.is_restricted ? "Restricted" : "Standard access"}</small></article>)}</div>;
  return <StorageWorkflowPanel section={section} rows={safeRows} canCreate={["requests", "suppliers", "maintenance", "audits"].includes(section)} onCreated={() => window.location.reload()} />;
}

export default function StorageWorkspace({ section = "overview", effectiveAccess, availableWorkspaces, onWorkspaceChange, onSectionChange }) {
  const permissionKeys = useMemo(() => getStoragePermissionKeys(effectiveAccess), [effectiveAccess]);
  const navigation = useMemo(() => getVisibleStorageNavigation(permissionKeys).map((item) => ({ ...item, Icon: icons[item.key] })), [permissionKeys]);
  const activeSection = navigation.some((item) => item.key === section) ? section : "overview";
  const [state, setState] = useState({ loading: true, error: "", data: null });
  useEffect(() => { let cancelled = false; setState({ loading: true, error: "", data: null }); const request = activeSection === "overview" ? getStorageOverview() : getStorageSectionData(activeSection); request.then((data) => { if (!cancelled) setState({ loading: false, error: "", data }); }).catch((error) => { if (!cancelled) setState({ loading: false, error: error.message, data: null }); }); return () => { cancelled = true; }; }, [activeSection]);
  const label = navigation.find((item) => item.key === activeSection)?.label ?? "Overview";
  return <FocusedWorkspaceShell workspaceKey="storage" workspaceLabel="Storage" workspaceIcon={Boxes} workspaces={availableWorkspaces} onWorkspaceChange={onWorkspaceChange} navigation={navigation} activeSection={activeSection} onSectionChange={onSectionChange}><div className="storage-page-heading"><div><span>Storage workspace</span><h1>{label}</h1><p>Traceable inventory, equipment custody, stock control, and safety.</p></div></div>{state.loading ? <StorageState title="Loading Storage data"><p>Retrieving only the inventory records you are permitted to view.</p><div className="storage-loading-bar" /></StorageState> : null}{!state.loading && state.error ? <StorageState title="Storage data could not be loaded" action={<button type="button" onClick={() => window.location.reload()}>Reload workspace</button>}><p>{state.error.includes("PGRST") || state.error.includes("schema cache") ? "Apply the Storage migration in Supabase, then reload this workspace." : state.error}</p></StorageState> : null}{!state.loading && !state.error && activeSection === "overview" ? <Overview data={state.data} /> : null}{!state.loading && !state.error && activeSection !== "overview" ? <SectionData section={activeSection} rows={state.data ?? []} /> : null}</FocusedWorkspaceShell>;
}
