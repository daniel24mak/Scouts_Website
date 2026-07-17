import { ChevronDown } from "lucide-react";
import "./workspaceShell.css";

export default function WorkspaceSwitcher({ workspaces = [], value, onChange }) {
  if (workspaces.length < 2) return null;

  return (
    <label className="workspace-switcher">
      <span className="sr-only">Workspace</span>
      <select value={value} onChange={(event) => onChange?.(event.target.value)}>
        {workspaces.map((workspace) => (
          <option value={workspace.key} key={workspace.key}>{workspace.label}</option>
        ))}
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </label>
  );
}
