export default function WorkspaceTabs({ tabs, activeTab, onChange, label = "Page views" }) {
  return <div className="workspace-tabs" role="tablist" aria-label={label}>{tabs.map((tab) => <button type="button" role="tab" aria-selected={activeTab === tab.key} className={activeTab === tab.key ? "active" : ""} key={tab.key} onClick={() => onChange(tab.key)}>{tab.label}</button>)}</div>;
}
