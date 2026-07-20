import { Archive, Bell, Boxes, ClipboardCheck, ClipboardList, FileBarChart2, Forklift, History, LayoutDashboard, ListTodo, MapPin, PackageCheck, PackageOpen, RefreshCcw, ShieldCheck, Sparkles, Truck, Wrench } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import FocusedWorkspaceShell from "../../workspaces/FocusedWorkspaceShell.jsx";
import WorkspaceAssistant from "../../workspaces/WorkspaceAssistant.jsx";
import WorkspaceRecordManager from "../../workspaces/WorkspaceRecordManager.jsx";
import { WorkspaceActivityLog, WorkspaceMyWork, WorkspaceNotifications } from "../../workspaces/WorkspaceSharedSections.jsx";
import WorkspaceTabs from "../../workspaces/WorkspaceTabs.jsx";
import { asArray } from "../../utils/collections.js";
import { getStorageOverview, getStorageSectionData, manageStorageRecord } from "./inventoryService.js";
import { getStoragePermissionKeys, getVisibleStorageNavigation, STORAGE_NAVIGATION, STORAGE_SECTION_TABS } from "./storageModel.js";
import StorageWorkflowPanel from "./StorageWorkflowPanel.jsx";
import "./storageWorkspace.css";

const icons = { overview: LayoutDashboard, aiAssistant: Sparkles, inventory: Boxes, requests: ClipboardList, loans: PackageOpen, "locations-movements": MapPin, procurement: Truck, maintenance: Wrench, audits: ClipboardCheck, reports: FileBarChart2, myWork: ListTodo, notifications: Bell };
const humanize = (value) => String(value ?? "").replaceAll("_", " ");

function StorageState({ title, children, action }) { return <section className="storage-state"><Forklift size={29} aria-hidden="true" /><h2>{title}</h2>{children}{action}</section>; }
function Status({ value }) { return <span className={`storage-status ${String(value).replaceAll("_", "-")}`}>{humanize(value)}</span>; }
function MovementTable({ rows }) { return <div className="storage-table-wrap"><table><thead><tr><th>Reference</th><th>Date</th><th>Movement</th><th>Quantity</th><th>Status</th></tr></thead><tbody>{asArray(rows).map((row) => <tr key={row.id}><td>{row.reference_number ?? "Pending"}</td><td>{new Date(row.created_at).toLocaleDateString("en-AE")}</td><td>{humanize(row.movement_type)}</td><td>{Number(row.quantity).toLocaleString("en-AE")}</td><td><Status value={row.status} /></td></tr>)}</tbody></table></div>; }

function Overview({ data }) {
  const overview = data && typeof data === "object" ? data : {};
  if (!overview.itemCount) {
    return <section className="storage-panel workspace-setup-panel"><header><div><span>Storage setup</span><h2>Prepare the Storage workspace</h2></div><Boxes size={20} /></header><p className="storage-empty-copy">Create the catalogue foundations once. Stock totals will then come from approved movements.</p><ol className="workspace-setup-list"><li>Create the first location</li><li>Add inventory items</li><li>Create a request template</li><li>Assign Storage users</li></ol></section>;
  }
  const recentMovements = asArray(overview.recentMovements);
  const actionItems = asArray(overview.actionItems);
  const cards = [["Available units", overview.availableUnits ?? 0], ["Currently issued", overview.issuedUnits ?? 0], ["Low-stock items", overview.lowStockCount ?? 0], ["Overdue or unsafe", (overview.overdueLoanCount ?? 0) + (overview.unsafeAssetCount ?? 0)]];
  return <><div className="storage-summary-grid">{cards.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><div className="storage-overview-grid"><section className="storage-panel"><header><div><span>Traceability</span><h2>Recent stock movements</h2></div><History size={20} /></header>{recentMovements.length ? <MovementTable rows={recentMovements} /> : <p className="storage-empty-copy">Receipts, issues, transfers, and returns will appear here.</p>}</section><section className="storage-panel"><header><div><span>Attention</span><h2>Storage actions</h2></div><ShieldCheck size={20} /></header>{actionItems.length ? actionItems.map((item) => <button type="button" key={item.id}>{item.title}</button>) : <p className="storage-empty-copy">No urgent Storage actions right now.</p>}</section></div></>;
}

const staticStorageFields = {
  kits: [{ key: "code", label: "Code", required: true }, { key: "name", label: "Kit name", required: true }, { key: "description", label: "Description" }],
  locations: [
    { key: "code", label: "Code", required: true }, { key: "name", label: "Location name", required: true },
    { key: "location_type", label: "Location type", type: "select", required: true, options: ["site", "room", "cabinet", "shelf", "bin", "vehicle", "temporary"] },
    { key: "is_restricted", label: "Restricted location", type: "checkbox" }, { key: "description", label: "Description" }
  ],
  categories: [{ key: "name", label: "Category name", required: true }, { key: "description", label: "Description" }]
};

function buildStorageFields(rows) {
  const categoryOptions = asArray(rows?.categories).map((category) => ({ value: category.id, label: category.name }));
  const itemOptions = asArray(rows?.items).map((item) => ({ value: item.id, label: `${item.name} (${item.sku})` }));
  return {
    inventory: [
      { key: "sku", label: "SKU", required: true }, { key: "name", label: "Item name", required: true },
      { key: "item_kind", label: "Item kind", type: "select", required: true, options: ["consumable", "bulk", "asset"] },
      { key: "category_id", label: "Category", type: "select", options: categoryOptions },
      { key: "unit_name", label: "Unit", defaultValue: "piece", required: true },
      { key: "reorder_level", label: "Reorder level", type: "number", defaultValue: 0 },
      { key: "safety_status", label: "Safety status", type: "select", defaultValue: "clear", options: ["clear", "inspection_due", "blocked", "retired"] }, { key: "description", label: "Description" }
    ],
    assets: [
      { key: "item_id", label: "Inventory item", type: "select", required: true, options: itemOptions }, { key: "asset_tag", label: "Asset tag", required: true },
      { key: "serial_number", label: "Serial number" },
      { key: "status", label: "Status", type: "select", required: true, options: ["available", "reserved", "issued", "maintenance", "damaged", "missing", "retired"] },
      { key: "condition", label: "Condition", type: "select", required: true, options: ["new", "good", "fair", "poor", "damaged", "unsafe"] },
      { key: "notes", label: "Notes" }
    ],
    ...staticStorageFields
  };
}

function SectionData({ section, rows, canManage, onRefresh }) {
  const tabs = STORAGE_SECTION_TABS[section];
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.key ?? section);
  useEffect(() => setActiveTab(STORAGE_SECTION_TABS[section]?.[0]?.key ?? section), [section]);
  const safeRows = asArray(tabs ? rows?.[activeTab] : rows);
  const leafSection = section === "inventory" ? (activeTab === "items" ? "inventory" : activeTab) : section === "locations-movements" ? activeTab : section === "procurement" ? activeTab : section;
  const storageFields = buildStorageFields(rows);
  const inventoryItems = asArray(rows?.items);
  const categories = asArray(rows?.categories);
  let content;
  if (leafSection === "movements") content = <section className="storage-panel"><h2>Movement history</h2>{safeRows.length ? <MovementTable rows={safeRows} /> : <p className="storage-empty-copy">Workflow-generated receipts, issues, returns, transfers, and adjustments will appear here.</p>}</section>;
  else if (["inventory", "assets", "kits", "locations", "categories"].includes(leafSection)) {
    const entity = { inventory: "item", assets: "asset", kits: "kit", locations: "location", categories: "category" }[leafSection];
    content = <WorkspaceRecordManager title={{ inventory: "All items", assets: "Assets", kits: "Kits", locations: "Locations", categories: "Categories" }[leafSection]} noun={entity} rows={safeRows} fields={storageFields[leafSection]} canManage={canManage} onMutate={async (action, id, payload) => { await manageStorageRecord(entity, action, id, payload); await onRefresh(); }} renderRecord={(record) => {
      const category = leafSection === "inventory" ? categories.find((item) => item.id === record.category_id) : null;
      const linkedItem = leafSection === "assets" ? inventoryItems.find((item) => item.id === record.item_id) : null;
      const categoryItemCount = leafSection === "categories" ? inventoryItems.filter((item) => item.category_id === record.id).length : 0;
      const secondary = leafSection === "assets" ? [record.asset_tag, record.serial_number].filter(Boolean).join(" · ") : record.sku || record.asset_tag || record.code || humanize(record.location_type);
      const heading = leafSection === "assets" ? linkedItem?.name || "Tracked asset" : record.name || record.serial_number || "Tracked asset";
      return <><div>{leafSection === "inventory" ? <Boxes size={21} /> : leafSection === "assets" ? <Archive size={21} /> : leafSection === "kits" ? <PackageCheck size={21} /> : <MapPin size={21} />}</div><div><small>{secondary}{category ? ` · ${category.name}` : ""}</small><h3>{heading}</h3>{leafSection === "categories" ? <small>{categoryItemCount ? `${categoryItemCount} ${categoryItemCount === 1 ? "item" : "items"}` : "No items yet"}</small> : null}<p>{record.description || record.notes || (leafSection === "inventory" ? `${Number(record.available_quantity ?? 0).toLocaleString("en-AE")} ${record.unit_name ?? "units"} available` : "No description")}</p></div>{leafSection === "assets" ? <Status value={record.condition} /> : null}</>;
    }} />;
  }
  else content = <StorageWorkflowPanel section={leafSection} rows={safeRows} canCreate={["requests", "suppliers", "maintenance", "audits"].includes(leafSection)} onCreated={onRefresh} />;
  return <>{tabs ? <WorkspaceTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} label={`${section} views`} /> : null}{content}</>;
}

export default function StorageWorkspace({ section = "overview", effectiveAccess, availableWorkspaces, onWorkspaceChange, onSectionChange }) {
  const permissionKeys = useMemo(() => getStoragePermissionKeys(effectiveAccess), [effectiveAccess]);
  const navigation = useMemo(() => getVisibleStorageNavigation(permissionKeys).map((item) => ({ ...item, Icon: icons[item.key] })), [permissionKeys]);
  const activeSection = navigation.some((item) => item.key === section) ? section : "overview";
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [reloadToken, setReloadToken] = useState(0);
  const refreshSection = async () => setReloadToken((value) => value + 1);
  const isSharedSection = ["reports", "myWork", "notifications"].includes(activeSection);
  useEffect(() => { let cancelled = false; if (isSharedSection) { setState({ loading: false, error: "", data: null }); return () => { cancelled = true; }; } setState({ loading: true, error: "", data: null }); const request = activeSection === "overview" ? getStorageOverview() : getStorageSectionData(activeSection); request.then((data) => { if (!cancelled) setState({ loading: false, error: "", data }); }).catch((error) => { if (!cancelled) setState({ loading: false, error: error.message, data: null }); }); return () => { cancelled = true; }; }, [activeSection, isSharedSection, reloadToken]);
  const label = navigation.find((item) => item.key === activeSection)?.label ?? "Overview";
  const canManageCatalog = permissionKeys.includes("storage.settings.manage");
  return <FocusedWorkspaceShell workspaceKey="storage" workspaceLabel="Storage" workspaceIcon={Boxes} workspaces={availableWorkspaces} onWorkspaceChange={onWorkspaceChange} navigation={navigation} activeSection={activeSection} onSectionChange={onSectionChange}><div className="storage-page-heading"><div><span>Storage workspace</span><h1>{label}</h1><p>Traceable inventory, equipment custody, stock control, and safety.</p></div></div>{state.loading ? <StorageState title="Loading Storage data"><p>Retrieving only the inventory records you are permitted to view.</p><div className="storage-loading-bar" /></StorageState> : null}{!state.loading && state.error ? <StorageState title="Storage data could not be loaded" action={<button type="button" onClick={() => window.location.reload()}>Reload workspace</button>}><p>{state.error.includes("PGRST") || state.error.includes("schema cache") ? "Apply the Storage migration in Supabase, then reload this workspace." : state.error}</p></StorageState> : null}{!state.loading && !state.error && activeSection === "overview" ? <Overview data={state.data} /> : null}{!state.loading && !state.error && activeSection === "aiAssistant" ? <WorkspaceAssistant workspaceLabel="Storage" /> : null}{activeSection === "reports" ? <WorkspaceActivityLog workspaceKey="storage" workspaceLabel="Storage" /> : null}{activeSection === "myWork" ? <WorkspaceMyWork workspaceKey="storage" effectiveAccess={effectiveAccess} /> : null}{activeSection === "notifications" ? <WorkspaceNotifications workspaceLabel="Storage" /> : null}{!state.loading && !state.error && !["overview", "aiAssistant", "reports", "myWork", "notifications"].includes(activeSection) ? <SectionData section={activeSection} rows={state.data ?? []} canManage={canManageCatalog} onRefresh={refreshSection} /> : null}</FocusedWorkspaceShell>;
}
