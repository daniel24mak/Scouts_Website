import {
  AlertTriangle, CheckCircle2, ChevronRight, Clock3, Filter, KeyRound, LockKeyhole,
  ImagePlus, Plus, RefreshCw, Search, ShieldCheck, Trash2, Users, UsersRound, X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AvatarCropModal from "../../components/AvatarCropModal.jsx";
import UserAvatar from "../../components/UserAvatar.jsx";
import { filterPeopleAccessUsers, normalizePeopleAccessInvitation } from "./peopleAccessModel.js";
import "./peopleAccessWorkspace.css";

const TABS = [
  ["users", "Users", Users],
  ["roles", "Roles", ShieldCheck],
  ["teams", "Teams", UsersRound],
  ["reviews", "Access Reviews", AlertTriangle],
  ["audit", "Audit Log", Clock3]
];

const safeDate = (value) => value ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai" }).format(new Date(value)) : "Unavailable";
const titleCase = (value) => String(value ?? "unknown").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function Badge({ children, tone = "neutral" }) {
  return <span className={`people-badge is-${tone}`}>{children}</span>;
}

function EmptyState({ icon: Icon = Users, title, message }) {
  return <div className="people-empty"><Icon aria-hidden="true" /><strong>{title}</strong><p>{message}</p></div>;
}

function SummaryCards({ summary }) {
  const items = [
    ["Active users", summary.activeUsers, "active"], ["Invited", summary.invitedUsers, "invited"],
    ["Disabled", summary.disabledUsers, "disabled"], ["Without MFA", summary.usersWithoutMfa ?? "Unavailable", "warning"],
    ["High-risk assignments", summary.highRiskAssignments, "danger"], ["Expiring soon", summary.expiringAccess, "warning"],
    ["Migration differences", summary.migrationDifferences, "warning"], ["Direct overrides", summary.directOverrides, "danger"]
  ];
  return <div className="people-summary-grid">{items.map(([label, value, tone]) => <article key={label} className={`people-summary is-${tone}`}><span>{label}</span><strong>{value}</strong></article>)}</div>;
}

function ChipList({ items, empty = "None" }) {
  if (!items?.length) return <span className="people-muted">{empty}</span>;
  const visible = items.slice(0, 2);
  return <div className="people-chips">{visible.map((item) => <Badge key={item.id ?? item.key ?? item.name}>{item.name ?? item.key}</Badge>)}{items.length > 2 && <Badge>+{items.length - 2} more</Badge>}</div>;
}

function UsersView({ workspace, onSelectUser }) {
  const [filters, setFilters] = useState({ search: "", status: "all", role: "all", team: "all", group: "all" });
  const users = useMemo(() => filterPeopleAccessUsers(workspace.users, filters), [filters, workspace.users]);
  const set = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const reset = () => setFilters({ search: "", status: "all", role: "all", team: "all", group: "all" });

  return <section className="people-view" aria-labelledby="people-users-heading">
    <div className="people-toolbar">
      <label className="people-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Search people</span><input value={filters.search} onChange={set("search")} placeholder="Search people, roles, teams, or groups" /></label>
      <div className="people-filter-row" aria-label="User filters">
        <Filter size={17} aria-hidden="true" />
        <select aria-label="Account status" value={filters.status} onChange={set("status")}><option value="all">All statuses</option>{["active", "invited", "disabled", "suspended", "archived"].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select>
        <select aria-label="Role" value={filters.role} onChange={set("role")}><option value="all">All roles</option>{workspace.roles.map((role) => <option key={role.id} value={role.key}>{role.name}</option>)}</select>
        <select aria-label="Team" value={filters.team} onChange={set("team")}><option value="all">All teams</option>{workspace.teams.map((team) => <option key={team.id} value={team.key}>{team.name}</option>)}</select>
        <select aria-label="Group" value={filters.group} onChange={set("group")}><option value="all">All groups</option>{workspace.groups.map((group) => <option key={group.id} value={group.key}>{group.name}</option>)}</select>
        <button type="button" className="people-text-button" onClick={reset}>Reset</button>
      </div>
    </div>
    {users.length ? <div className="people-table-wrap"><table className="people-table"><thead><tr><th>Person</th><th>Status</th><th>Scouting</th><th>Roles</th><th>Teams</th><th>Security</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{users.map((person) => <tr key={person.id}>
      <td><button type="button" className="people-person-link" onClick={() => onSelectUser(person)}><UserAvatar name={person.name} imageUrl={person.profilePictureUrl} size={42} /><span><strong>{person.name}</strong><small>{person.email}</small></span></button></td>
      <td><Badge tone={person.accountStatus === "active" ? "success" : person.accountStatus === "disabled" ? "danger" : "warning"}>{titleCase(person.accountStatus)}</Badge></td>
      <td><strong>{person.scoutingPosition ? titleCase(person.scoutingPosition) : "Not assigned"}</strong><small>{person.primaryGroup ?? "No primary group"}</small></td>
      <td><ChipList items={person.roles} /></td><td><ChipList items={person.teams} /></td>
      <td>{person.mfaStatus === "unavailable" ? <Badge>Unavailable</Badge> : <Badge tone={person.mfaStatus === "enrolled" ? "success" : "warning"}>{titleCase(person.mfaStatus)}</Badge>}{person.warnings.length > 0 && <AlertTriangle className="people-warning-icon" size={17} aria-label={`${person.warnings.length} access warnings`} />}</td>
      <td><button type="button" className="people-icon-button" aria-label={`View ${person.name}`} onClick={() => onSelectUser(person)}><ChevronRight aria-hidden="true" /></button></td>
    </tr>)}</tbody></table></div> : <EmptyState title="No users match these filters" message="Reset the filters or try a different search." />}
  </section>;
}

function DetailList({ title, items, empty, renderItem }) {
  return <section className="people-detail-section"><div className="people-section-heading"><h3>{title}</h3></div>{items?.length ? <div className="people-assignment-list">{items.map((item, index) => <article key={item.id ?? `${title}-${index}`}>{renderItem(item)}</article>)}</div> : <p className="people-empty-inline">{empty}</p>}</section>;
}

function AssignmentEditor({ kind, user, items = [], options = [], canEdit, onChange }) {
  const [draft, setDraft] = useState({ targetId: "", position: kind === "team" ? "member" : "chief", scopeType: "global", scopeId: "", expiresAt: "", reason: "People & Access account update" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedOption = options.find((option) => option.id === draft.targetId);
  const save = async () => {
    if (!draft.targetId) return;
    setBusy(true); setError("");
    try {
      const payload = kind === "group"
        ? { groupId: draft.targetId, position: draft.position, isPrimary: items.length === 0, reason: draft.reason }
        : kind === "team"
          ? { teamId: draft.targetId, position: draft.position, reason: draft.reason }
          : { roleId: draft.targetId, scopeType: draft.scopeType, scopeId: ["global", "own_records"].includes(draft.scopeType) ? null : draft.scopeId, expiresAt: draft.expiresAt || null, reason: draft.reason };
      await onChange(kind, "save", user, payload);
      setDraft((current) => ({ ...current, targetId: "", scopeId: "", expiresAt: "" }));
    } catch (caught) { setError(caught?.message || "The assignment could not be saved."); }
    finally { setBusy(false); }
  };
  const remove = async (item) => {
    setBusy(true); setError("");
    try { await onChange(kind, "remove", user, { id: item.id, reason: draft.reason }); }
    catch (caught) { setError(caught?.message || "The assignment could not be removed."); }
    finally { setBusy(false); }
  };
  const title = kind === "group" ? "Scouting assignments" : kind === "team" ? "Team memberships" : "Role assignments";
  return <div className="people-assignment-editor">
    <DetailList title={title} items={items} empty={`No ${kind} assignments.`} renderItem={(item) => <><span><strong>{item.name ?? item[`${kind}_name`] ?? item[`${kind}_id`] ?? item.key}</strong><small>{kind === "role" ? titleCase(item.scopeType ?? item.scope_type) : titleCase(item.position ?? "member")}</small></span>{canEdit && <button type="button" className="people-icon-button is-danger" aria-label={`Remove ${item.name ?? kind}`} disabled={busy} onClick={() => remove(item)}><Trash2 size={17} /></button>}</>} />
    {canEdit && <section className="people-assignment-form"><h3>Add {kind}</h3><div className="people-assignment-fields"><label>{titleCase(kind)}<select value={draft.targetId} onChange={(event) => setDraft((current) => ({ ...current, targetId: event.target.value }))}><option value="">Choose {kind}</option>{options.filter((option) => option.isActive !== false).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>{kind !== "role" && <label>Position<select value={draft.position} onChange={(event) => setDraft((current) => ({ ...current, position: event.target.value }))}>{(kind === "team" ? ["member", "assistant", "coordinator", "manager"] : ["chief", "vice_chief", "head_chief", "coordinator", "equipe_leader", "assistant"]).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>}{kind === "role" && <><label>Scope<select value={draft.scopeType} onChange={(event) => setDraft((current) => ({ ...current, scopeType: event.target.value, scopeId: "" }))}>{(selectedOption?.supportedScopes?.length ? selectedOption.supportedScopes : ["global", "group", "team", "event", "own_records"]).map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>{!["global", "own_records"].includes(draft.scopeType) && <label>Scope reference<input value={draft.scopeId} onChange={(event) => setDraft((current) => ({ ...current, scopeId: event.target.value }))} /></label>}<label>Expires on (optional)<input type="datetime-local" value={draft.expiresAt} onChange={(event) => setDraft((current) => ({ ...current, expiresAt: event.target.value }))} /></label></>}</div><label>Change reason<textarea rows="2" value={draft.reason} onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))} /></label><button type="button" className="people-primary-button" disabled={busy || !draft.targetId || draft.reason.trim().length < 8 || (kind === "role" && !["global", "own_records"].includes(draft.scopeType) && !draft.scopeId.trim())} onClick={save}>{busy ? "Saving..." : `Add ${kind}`}</button></section>}
    {error && <div className="people-error" role="alert"><AlertTriangle /><p>{error}</p></div>}
  </div>;
}

function UserDrawer({ person, details, loading, workspace, capabilities, onClose, onAction, onAssignmentChange }) {
  const [tab, setTab] = useState("overview");
  const [actionError, setActionError] = useState("");
  const sections = ["overview", "scouting", "teams", "roles", "effective", "security", "activity"];
  const user = details?.user?.id ? { ...person, ...details.user, legacyAccess: { ...(person.legacyAccess ?? {}), ...(details.user.legacyAccess ?? {}) } } : person;
  const runAction = async (action) => {
    setActionError("");
    try {
      if (action === "editProfile") onClose();
      const completed = await onAction(action, user);
      if (action === "delete" && completed !== false) onClose();
    } catch (error) { setActionError(error?.message || "The account action could not be completed."); }
  };
  return <div className="people-drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="people-drawer" role="dialog" aria-modal="true" aria-labelledby="people-user-title">
    <header><div className="people-drawer-person"><UserAvatar name={user.name} imageUrl={user.profilePictureUrl} size={58} /><div><h2 id="people-user-title">{user.name}</h2><p>{user.email}</p></div></div><button type="button" className="people-icon-button" aria-label="Close user details" onClick={onClose}><X /></button></header>
    <nav className="people-subtabs" aria-label="User details">{sections.map((id) => <button type="button" key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{titleCase(id)}</button>)}</nav>
    <div className="people-drawer-body">{loading ? <div className="people-skeleton-stack" aria-label="Loading user access"><span /><span /><span /></div> : <>
      {tab === "overview" && <div className="people-overview-stack"><div className="people-profile-summary"><Badge tone={user.accountStatus === "active" ? "success" : "warning"}>{titleCase(user.accountStatus)}</Badge><dl><div><dt>Invitation</dt><dd>{titleCase(user.invitationStatus)}</dd></div><div><dt>MFA</dt><dd>{titleCase(details?.security?.mfaStatus ?? "unavailable")}</dd></div><div><dt>Last active</dt><dd>{safeDate(user.lastActive)}</dd></div></dl></div>{user.warnings?.map((warning) => <div className="people-warning" key={String(warning)}><AlertTriangle /><span>{typeof warning === "string" ? warning : warning.message}</span></div>)}<DetailList title="Roles" items={details?.roleAssignments ?? user.roles} empty="No active role assignments." renderItem={(item) => <><strong>{item.name ?? item.role_name ?? item.role_id}</strong><span>{titleCase(item.scopeType ?? item.scope_type)}{item.scopeId || item.scope_id ? ` · ${item.scopeId ?? item.scope_id}` : ""}</span></>} /><DetailList title="Teams" items={details?.teamMemberships ?? user.teams} empty="No team memberships." renderItem={(item) => <><strong>{item.name ?? item.team_name ?? item.team_id}</strong><span>{titleCase(item.position ?? "member")}</span></>} /></div>}
      {tab === "scouting" && <AssignmentEditor kind="group" user={user} items={details?.groupAssignments ?? user.groups} options={workspace.groups} canEdit={capabilities.assignGroups} onChange={onAssignmentChange} />}
      {tab === "teams" && <><p className="people-advisory">Team membership describes where a user belongs. It does not automatically grant system permissions.</p><AssignmentEditor kind="team" user={user} items={details?.teamMemberships ?? user.teams} options={workspace.teams} canEdit={capabilities.assignTeams} onChange={onAssignmentChange} /></>}
      {tab === "roles" && <><AssignmentEditor kind="role" user={user} items={details?.roleAssignments ?? user.roles} options={workspace.roles} canEdit={capabilities.assignRoles} onChange={onAssignmentChange} /><div className="people-advisory is-warning">Direct overrides make access harder to review. Prefer assigning a role whenever possible.</div><DetailList title="Advanced permission overrides" items={details?.permissionOverrides} empty="No direct overrides." renderItem={(item) => <><strong>{item.permission_name ?? item.permission_id}</strong><Badge tone={item.effect === "deny" ? "danger" : "warning"}>{titleCase(item.effect)}</Badge><span>{item.reason}</span></>} /></>}
      {tab === "effective" && <EffectiveAccess access={details?.effectiveAccess} />}
      {tab === "security" && <section className="people-security"><h3>Security</h3><dl>{[["MFA enrollment", details?.security?.mfaStatus], ["MFA required", details?.security?.mfaRequired], ["Assurance level", details?.security?.assuranceLevel], ["Last sign-in", details?.security?.lastSignIn ? safeDate(details.security.lastSignIn) : null], ["Last password reset", details?.security?.lastPasswordReset ? safeDate(details.security.lastPasswordReset) : null], ["Active sessions", details?.security?.activeSessions]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value === null || value === undefined ? "Unavailable" : typeof value === "boolean" ? (value ? "Required" : "Not required") : titleCase(value)}</dd></div>)}</dl>{capabilities.resetPassword && <button type="button" className="people-secondary-button" onClick={() => runAction("passwordReset")}><KeyRound />Send password reset</button>}</section>}
      {tab === "activity" && <DetailList title="Access activity" items={details?.activity} empty="No access activity is available." renderItem={(item) => <><strong>{item.action ?? "Access changed"}</strong><span>{item.actor_name ?? "System"} · {safeDate(item.created_at ?? item.createdAt)}</span><small>{item.reason ?? item.outcome ?? ""}</small></>} />}
    </>}{actionError && <div className="people-error" role="alert"><AlertTriangle /><div><strong>Account action failed</strong><p>{actionError}</p></div></div>}</div>
    {(capabilities.editUser || capabilities.deleteUser) && <footer>{capabilities.editUser && <button type="button" className="people-secondary-button" onClick={() => runAction("editProfile")}>Edit profile & account</button>}{capabilities.deleteUser && <button type="button" className="people-danger-button" disabled={user.id === capabilities.currentUserId} title={user.id === capabilities.currentUserId ? "You cannot delete the account you are currently using." : "Permanently delete this account"} onClick={() => runAction("delete")}>Delete account</button>}</footer>}
  </aside></div>;
}

function EffectiveAccess({ access }) {
  const permissions = access?.permissions ?? [];
  const grouped = permissions.reduce((groups, item) => { const module = String(item.key ?? "other").split(".")[0]; (groups[module] ??= []).push(item); return groups; }, {});
  return <section className="people-effective"><h3>Effective access</h3><p>Trusted server-calculated access, including role grants and direct denies.</p>{Object.keys(grouped).length ? Object.entries(grouped).map(([module, items]) => <article key={module}><h4>{titleCase(module)}</h4>{items.map((item, index) => <div key={`${item.key}-${index}`}><span><strong>{titleCase(item.key)}</strong><small>{item.key}</small></span><span>{titleCase(item.scopeType)}{item.scopeId ? ` · ${item.scopeId}` : ""}</span><span>{item.source ?? "Role"}</span>{item.requiresMfa && <Badge tone="warning">MFA</Badge>}</div>)}</article>) : <EmptyState icon={ShieldCheck} title="No effective permissions" message="This user has no active normalized grants, or access could not be calculated." />}</section>;
}

function CatalogView({ kind, items, canCreate, onCreate }) {
  const isRole = kind === "role";
  return <section className="people-view"><div className="people-view-heading"><div><h2>{isRole ? "Roles" : "Teams"}</h2><p>{isRole ? "Reusable permission bundles with explicit scopes and security requirements." : "Organizational membership is separate from system authorization."}</p></div>{canCreate && <button type="button" className="people-primary-button" onClick={onCreate}><Plus />Create {titleCase(kind)}</button>}</div>
    {items.length ? <div className="people-catalog-grid">{items.map((item) => <article key={item.id}><div><Badge tone={item.riskLevel === "high" ? "danger" : item.riskLevel === "elevated" ? "warning" : "neutral"}>{titleCase(item.riskLevel)}</Badge>{item.isSystem && <Badge>Protected</Badge>}</div><h3>{item.name}</h3><p>{item.description || (isRole ? "No role description provided." : "No team description provided.")}</p><dl><div><dt>{isRole ? "Assigned users" : "Members"}</dt><dd>{item.memberCount}</dd></div>{isRole && <div><dt>Permissions</dt><dd>{item.permissionCount}</dd></div>}<div><dt>Status</dt><dd>{item.isActive ? "Active" : "Disabled"}</dd></div></dl>{isRole && <ChipList items={item.supportedScopes.map((scope) => ({ key: scope, name: titleCase(scope) }))} empty="No scopes configured" />}</article>)}</div> : <EmptyState icon={isRole ? ShieldCheck : UsersRound} title={isRole ? "No roles are available" : "No organizational teams have been created yet"} message={isRole ? "Run the access-control seed or create an authorized custom role." : "Create a team when people need an organizational membership."} />}
  </section>;
}

function ReviewView({ reviews, differences, onDecision }) {
  const items = [...reviews.map((item) => ({ ...item, source: "review" })), ...differences.map((item) => ({ ...item, source: "migration" }))];
  return <section className="people-view"><div className="people-view-heading"><div><h2>Access Reviews</h2><p>Resolve risky assignments and migration differences deliberately.</p></div></div>{items.length ? <div className="people-review-list">{items.map((item) => <article key={`${item.source}-${item.id}`}><div><Badge tone="warning">{item.source === "migration" ? "Migration difference" : titleCase(item.review_type ?? item.reviewType)}</Badge><strong>{item.user_name ?? item.target_name ?? item.permission_key ?? "Access review"}</strong><p>{item.decision_reason ?? item.resolution_note ?? "Review the current access and record a decision."}</p></div><div><button type="button" className="people-secondary-button" onClick={() => onDecision(item, "confirmed")}>Confirm</button><button type="button" className="people-danger-button" onClick={() => onDecision(item, "remove_access")}>Remove access</button></div></article>)}</div> : <EmptyState icon={CheckCircle2} title="No access issues currently require review" message="New high-risk, temporary, override, and migration findings will appear here." />}</section>;
}

function AuditView({ logs }) {
  const [search, setSearch] = useState("");
  const visible = logs.filter((item) => JSON.stringify(item).toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <section className="people-view"><div className="people-view-heading"><div><h2>Audit Log</h2><p>Immutable access and account activity. Sensitive credentials are never displayed.</p></div></div><label className="people-search"><Search /><span className="sr-only">Search audit log</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search actor, action, target, or outcome" /></label>{visible.length ? <div className="people-table-wrap"><table className="people-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Outcome</th><th>Reason</th></tr></thead><tbody>{visible.map((item) => <tr key={item.id}><td>{safeDate(item.created_at ?? item.createdAt)}</td><td>{item.actor_name ?? item.actor_id ?? "System"}</td><td>{titleCase(item.action)}</td><td>{item.target_name ?? item.resource_id ?? item.entity_id ?? "-"}</td><td><Badge tone={item.outcome === "failed" ? "danger" : "success"}>{titleCase(item.outcome ?? "recorded")}</Badge></td><td>{item.reason ?? "-"}</td></tr>)}</tbody></table></div> : <EmptyState icon={Clock3} title="No activity matches the selected filters" message="Try a different search." />}</section>;
}

function InviteWizard({ workspace, onClose, onSubmit }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [cropFile, setCropFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [draft, setDraft] = useState({ name: "", email: "", profilePictureFile: null, groups: [], teams: [], roles: [], reason: "Initial dashboard access" });
  const steps = ["Profile", "Scouting", "Teams", "Roles & security", "Review"];

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const set = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }));
  const findAssignment = (kind, key, id) => draft[kind].find((item) => item[key] === id);
  const toggleAssignment = (kind, key, id, defaults, checked) => setDraft((current) => ({
    ...current,
    [kind]: checked ? [...current[kind], { [key]: id, ...defaults }] : current[kind].filter((item) => item[key] !== id)
  }));
  const updateAssignment = (kind, key, id, patch) => setDraft((current) => ({
    ...current,
    [kind]: current[kind].map((item) => item[key] === id ? { ...item, ...patch } : item)
  }));
  const canContinue = step === 0
    ? Boolean(draft.name.trim() && /.+@.+\..+/.test(draft.email))
    : step !== 3 || draft.roles.every((role) => role.reason.trim().length >= 8 && (["global", "own_records"].includes(role.scopeType) || role.scopeId.trim()));
  const submit = async () => {
    setSaving(true);
    setError("");
    try { await onSubmit(normalizePeopleAccessInvitation(draft)); onClose(); }
    catch (caught) { setError(caught?.message || "The invitation could not be sent."); }
    finally { setSaving(false); }
  };

  return <div className="people-drawer-backdrop" role="presentation">
    <section className="people-invite" role="dialog" aria-modal="true" aria-labelledby="people-invite-title">
      <header><div><p className="people-kicker">Secure invitation</p><h2 id="people-invite-title">Invite User</h2></div><button type="button" className="people-icon-button" aria-label="Close invitation" onClick={onClose}><X /></button></header>
      <ol className="people-stepper">{steps.map((label, index) => <li className={index === step ? "active" : index < step ? "complete" : ""} key={label}><span>{index + 1}</span><small>{label}</small></li>)}</ol>
      <div className="people-invite-body">
        {step === 0 && <div className="people-form-grid">
          <div className="people-avatar-field"><UserAvatar name={draft.name || "New user"} imageUrl={previewUrl} size={72} /><label className="people-upload-button"><ImagePlus size={18} />Choose profile picture<input type="file" accept="image/*" onChange={(event) => setCropFile(event.target.files?.[0] ?? null)} /></label>{draft.profilePictureFile && <button type="button" className="people-text-button" onClick={() => { setPreviewUrl(""); setDraft((current) => ({ ...current, profilePictureFile: null })); }}><Trash2 size={16} />Remove</button>}</div>
          <label>Full name<input autoFocus value={draft.name} onChange={set("name")} placeholder="Full name" /></label>
          <label>Email address<input type="email" value={draft.email} onChange={set("email")} placeholder="name@example.com" /></label>
          <p className="people-advisory">A secure invitation email will be sent. No temporary password is created or displayed.</p>
        </div>}
        {step === 1 && <div className="people-form-grid"><p className="people-field-intro">Select every scouting group this user belongs to.</p><div className="people-selection-list">{workspace.groups.map((group) => { const assignment = findAssignment("groups", "groupId", group.id); return <article key={group.id} className={assignment ? "selected" : ""}><label className="people-check-row"><input type="checkbox" checked={Boolean(assignment)} onChange={(event) => toggleAssignment("groups", "groupId", group.id, { position: "chief", isPrimary: draft.groups.length === 0 }, event.target.checked)} /><span><strong>{group.name}</strong><small>{group.description || "Scouting group"}</small></span></label>{assignment && <label>Position<select value={assignment.position} onChange={(event) => updateAssignment("groups", "groupId", group.id, { position: event.target.value })}>{["chief", "vice_chief", "head_chief", "coordinator", "equipe_leader", "assistant"].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>}</article>; })}</div></div>}
        {step === 2 && <div className="people-form-grid"><p className="people-advisory">Teams describe where a user belongs. Select as many as needed; teams do not automatically grant permissions.</p><div className="people-selection-list">{workspace.teams.map((team) => { const assignment = findAssignment("teams", "teamId", team.id); return <article key={team.id} className={assignment ? "selected" : ""}><label className="people-check-row"><input type="checkbox" checked={Boolean(assignment)} onChange={(event) => toggleAssignment("teams", "teamId", team.id, { position: "member" }, event.target.checked)} /><span><strong>{team.name}</strong><small>{team.description || "Organizational team"}</small></span></label>{assignment && <label>Team position<select value={assignment.position} onChange={(event) => updateAssignment("teams", "teamId", team.id, { position: event.target.value })}>{["member", "assistant", "coordinator", "manager"].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>}</article>; })}</div></div>}
        {step === 3 && <div className="people-form-grid"><p className="people-field-intro">Assign one or more roles. Each role keeps its own scope and expiry.</p><div className="people-selection-list">{workspace.roles.filter((role) => role.isActive).map((role) => { const assignment = findAssignment("roles", "roleId", role.id); const scopes = role.supportedScopes?.length ? role.supportedScopes : ["global", "group", "team", "event", "own_records"]; return <article key={role.id} className={assignment ? "selected" : ""}><label className="people-check-row"><input type="checkbox" checked={Boolean(assignment)} onChange={(event) => toggleAssignment("roles", "roleId", role.id, { scopeType: scopes[0] || "global", scopeId: "", expiresAt: "", reason: draft.reason }, event.target.checked)} /><span><strong>{role.name}</strong><small>{role.description || "Access role"}</small></span></label>{assignment && <div className="people-assignment-fields"><label>Scope<select value={assignment.scopeType} onChange={(event) => updateAssignment("roles", "roleId", role.id, { scopeType: event.target.value, scopeId: "" })}>{scopes.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>{!["global", "own_records"].includes(assignment.scopeType) && <label>Scope reference<input value={assignment.scopeId} onChange={(event) => updateAssignment("roles", "roleId", role.id, { scopeId: event.target.value })} placeholder="Group, team, or event ID" /></label>}<label>Expires on (optional)<input type="datetime-local" value={assignment.expiresAt} onChange={(event) => updateAssignment("roles", "roleId", role.id, { expiresAt: event.target.value })} /></label><label>Assignment reason<textarea rows="2" value={assignment.reason} onChange={(event) => updateAssignment("roles", "roleId", role.id, { reason: event.target.value })} /></label></div>}{role.riskLevel === "high" && assignment && <div className="people-warning"><AlertTriangle /><span>High-risk role. Server permission and MFA checks apply.</span></div>}</article>; })}</div></div>}
        {step === 4 && <div className="people-review-card"><h3>Review invitation</h3><dl><div><dt>Person</dt><dd>{draft.name} - {draft.email}{draft.profilePictureFile ? " - Profile picture ready" : ""}</dd></div><div><dt>Scouting</dt><dd>{draft.groups.length ? draft.groups.map((item) => `${workspace.groups.find((group) => group.id === item.groupId)?.name ?? item.groupId} (${titleCase(item.position)})`).join(", ") : "None"}</dd></div><div><dt>Teams</dt><dd>{draft.teams.length ? draft.teams.map((item) => workspace.teams.find((team) => team.id === item.teamId)?.name ?? item.teamId).join(", ") : "None"}</dd></div><div><dt>Roles</dt><dd>{draft.roles.length ? draft.roles.map((item) => `${workspace.roles.find((role) => role.id === item.roleId)?.name ?? item.roleId} (${titleCase(item.scopeType)})`).join(", ") : "None"}</dd></div><div><dt>Invitation</dt><dd>Secure email invitation</dd></div></dl></div>}
        {error && <div className="people-error" role="alert"><AlertTriangle /><div><strong>Invitation failed</strong><p>{error}</p></div></div>}
      </div>
      <footer><button type="button" className="people-secondary-button" disabled={saving} onClick={() => step ? setStep((value) => value - 1) : onClose()}>{step ? "Back" : "Cancel"}</button>{step < steps.length - 1 ? <button type="button" className="people-primary-button" disabled={!canContinue} onClick={() => setStep((value) => value + 1)}>Continue</button> : <button type="button" className="people-primary-button" disabled={saving} onClick={submit}>{saving ? "Sending invitation..." : "Send invitation"}</button>}</footer>
    </section>
    {cropFile && <AvatarCropModal file={cropFile} title="Crop profile picture" shape="circle" confirmLabel="Use profile picture" onCancel={() => setCropFile(null)} onConfirm={(file) => { setDraft((current) => ({ ...current, profilePictureFile: file })); setPreviewUrl(URL.createObjectURL(file)); setCropFile(null); }} />}
  </div>;
}

export default function PeopleAccessWorkspace({ workspace, loading, error, warning, capabilities = {}, onRefresh, onInvite, onLoadUser, onUserAction, onAssignmentChange, onCreateRole, onCreateTeam, onReviewDecision }) {
  const visibleTabs = TABS.filter(([id]) => capabilities[id] !== false);
  const [tab, setTab] = useState(visibleTabs[0]?.[0] ?? "users");
  const [selectedUser, setSelectedUser] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [details, setDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const openUser = async (person) => { setSelectedUser(person); setDetails(null); setDetailLoading(true); try { setDetails(await onLoadUser?.(person.id)); } finally { setDetailLoading(false); } };
  const closeUser = () => { setSelectedUser(null); setDetails(null); };
  if (loading) return <div className="people-workspace"><div className="people-skeleton-stack" aria-label="Loading People and Access"><span /><span /><span /><span /></div></div>;
  if (error) return <div className="people-workspace"><div className="people-error"><AlertTriangle /><div><strong>People & Access could not be loaded</strong><p>{error}</p></div><button type="button" className="people-secondary-button" onClick={onRefresh}><RefreshCw />Try again</button></div></div>;
  return <div className="people-workspace">
    <header className="people-header"><div><p className="people-kicker"><LockKeyhole />Administration</p><h1>People & Access</h1><p>Manage identities, scouting assignments, teams, normalized roles, reviews, and effective access.</p></div><div className="people-header-actions"><button type="button" className="people-icon-button" aria-label="Refresh People and Access" onClick={onRefresh}><RefreshCw /></button>{capabilities.invite !== false && <button type="button" className="people-primary-button" onClick={() => setInviteOpen(true)}><Plus />Invite User</button>}</div></header>
    {warning && <div className="people-warning" role="status"><AlertTriangle /><span>{warning}</span></div>}
    <SummaryCards summary={workspace.summary} />
    <nav className="people-tabs" aria-label="People and Access sections">{visibleTabs.map(([id, label, Icon]) => <button type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} key={id} onClick={() => setTab(id)}><Icon aria-hidden="true" />{label}</button>)}</nav>
    {tab === "users" && <UsersView workspace={workspace} onSelectUser={openUser} />}
    {tab === "roles" && <CatalogView kind="role" items={workspace.roles} canCreate={capabilities.createRole} onCreate={onCreateRole} />}
    {tab === "teams" && <CatalogView kind="team" items={workspace.teams} canCreate={capabilities.createTeam} onCreate={onCreateTeam} />}
    {tab === "reviews" && <ReviewView reviews={workspace.accessReviews} differences={workspace.migrationDifferences} onDecision={onReviewDecision} />}
    {tab === "audit" && <AuditView logs={workspace.auditLogs} />}
    {selectedUser && <UserDrawer person={selectedUser} details={details} loading={detailLoading} workspace={workspace} capabilities={capabilities} onClose={closeUser} onAction={onUserAction} onAssignmentChange={async (...args) => { const next = await onAssignmentChange(...args); if (next) setDetails(next); return next; }} />}
    {inviteOpen && <InviteWizard workspace={workspace} onClose={() => setInviteOpen(false)} onSubmit={onInvite} />}
  </div>;
}
