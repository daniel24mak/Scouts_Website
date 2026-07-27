import { CalendarDays, ShieldCheck, Users } from "lucide-react";
import { normalizeRegistrationSettings } from "./registrationModel.js";

function Toggle({ checked, onChange, children }) {
  return <label className="toggle-row"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />{children}</label>;
}

export default function RegistrationCampaignSettings({ value, onChange, scoutYears = [], groups = [] }) {
  const settings = normalizeRegistrationSettings(value);
  const update = (patch) => onChange(normalizeRegistrationSettings({ ...settings, ...patch }));
  const toggleGroup = (groupId, checked) => update({
    acceptedGroupIds: checked
      ? [...new Set([...settings.acceptedGroupIds, groupId])]
      : settings.acceptedGroupIds.filter((id) => id !== groupId)
  });

  return (
    <div className="registration-campaign-settings">
      <header>
        <ShieldCheck size={22} aria-hidden="true" />
        <div><strong>Scout registration campaign</strong><p>One secure link supports returning and new scouts.</p></div>
      </header>

      <section>
        <h4>Campaign</h4>
        <div className="inline-editor-grid">
          <label>Scout season<select value={settings.seasonId} onChange={(event) => update({ seasonId: event.target.value })}><option value="">Choose season</option>{scoutYears.map((year) => <option key={year.id} value={year.id}>{year.label}</option>)}</select></label>
          <label>Registration title<input value={settings.registrationTitle} onChange={(event) => update({ registrationTitle: event.target.value })} placeholder="2026 Scout Registration" /></label>
          <label>Public slug<div className="registration-slug-input"><span>/register/</span><input value={settings.slug} onChange={(event) => update({ slug: event.target.value })} placeholder="2026-registration" /></div></label>
          <label>Capacity<input type="number" min="1" value={settings.capacity ?? ""} onChange={(event) => update({ capacity: event.target.value })} placeholder="Unlimited" /></label>
        </div>
      </section>

      <section>
        <h4><CalendarDays size={17} /> Availability</h4>
        <div className="registration-toggle-grid">
          <Toggle checked={settings.returningEnabled} onChange={(returningEnabled) => update({ returningEnabled })}>Returning scouts</Toggle>
          <Toggle checked={settings.newEnabled} onChange={(newEnabled) => update({ newEnabled })}>New scouts</Toggle>
          <Toggle checked={settings.newScoutWaitlist} onChange={(newScoutWaitlist) => update({ newScoutWaitlist })}>New-scout waitlist</Toggle>
          <Toggle checked={settings.showOpeningDate} onChange={(showOpeningDate) => update({ showOpeningDate })}>Show opening dates publicly</Toggle>
        </div>
        <div className="inline-editor-grid">
          <label>Returning opens<input type="datetime-local" value={settings.returningOpensAt ?? ""} onChange={(event) => update({ returningOpensAt: event.target.value })} /></label>
          <label>New scouts open<input type="datetime-local" value={settings.newOpensAt ?? ""} onChange={(event) => update({ newOpensAt: event.target.value })} /></label>
          <label>Registration closes<input type="datetime-local" value={settings.closesAt ?? ""} onChange={(event) => update({ closesAt: event.target.value })} /></label>
        </div>
      </section>

      <section>
        <h4><Users size={17} /> Eligibility</h4>
        <div className="forms-group-picker">{groups.map((group) => <label key={group.id}><input type="checkbox" checked={settings.acceptedGroupIds.includes(group.id)} onChange={(event) => toggleGroup(group.id, event.target.checked)} />{group.name}</label>)}</div>
        <div className="inline-editor-grid">
          <label>Minimum age<input type="number" min="0" value={settings.minimumAge ?? ""} onChange={(event) => update({ minimumAge: event.target.value })} /></label>
          <label>Maximum age<input type="number" min="0" value={settings.maximumAge ?? ""} onChange={(event) => update({ maximumAge: event.target.value })} /></label>
          <label>Birth year from<input type="number" min="1990" value={settings.birthYearFrom ?? ""} onChange={(event) => update({ birthYearFrom: event.target.value })} /></label>
          <label>Birth year to<input type="number" min="1990" value={settings.birthYearTo ?? ""} onChange={(event) => update({ birthYearTo: event.target.value })} /></label>
        </div>
      </section>

      <section>
        <h4>Documents and review</h4>
        <div className="registration-toggle-grid">
          <Toggle checked={settings.requireHeadshot} onChange={(requireHeadshot) => update({ requireHeadshot })}>Require scout headshot</Toggle>
          <Toggle checked={settings.requireIdFront} onChange={(requireIdFront) => update({ requireIdFront })}>Require ID front</Toggle>
          <Toggle checked={settings.requireIdBack} onChange={(requireIdBack) => update({ requireIdBack })}>Require ID back</Toggle>
          <Toggle checked={settings.requireVerification} onChange={(requireVerification) => update({ requireVerification })}>Require group verification</Toggle>
          <Toggle checked={settings.requireParentVerification} onChange={(requireParentVerification) => update({ requireParentVerification })}>Verify parent contact</Toggle>
          <Toggle checked={settings.allowDrafts} onChange={(allowDrafts) => update({ allowDrafts })}>Allow draft and resume</Toggle>
        </div>
      </section>

      <section>
        <h4>Privacy and consent</h4>
        <label>Privacy notice<textarea value={settings.privacyText} onChange={(event) => update({ privacyText: event.target.value })} placeholder="Explain how registration data is used and who may review it." /></label>
        <label>Consent text<textarea value={settings.consentText} onChange={(event) => update({ consentText: event.target.value })} placeholder="I confirm that the information is accurate and consent to its use for scout registration." /></label>
        <label>Retention notice<textarea value={settings.retentionText} onChange={(event) => update({ retentionText: event.target.value })} placeholder="Explain when sensitive registration documents are reviewed and deleted." /></label>
      </section>
    </div>
  );
}

