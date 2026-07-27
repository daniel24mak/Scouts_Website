import { Copy, ExternalLink, FilePenLine, Pause, Play, QrCode, ShieldCheck } from "lucide-react";
import { setRegistrationCampaignStatus } from "./registrationService.js";

function publicRegistrationUrl(slug) {
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`;
  return `${base}#/register/${encodeURIComponent(slug)}`;
}

async function copyLink(url, setSaveMessage) {
  await navigator.clipboard.writeText(url);
  setSaveMessage("Registration link copied.");
}

async function downloadQr(url, title, setSaveMessage) {
  const source = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&format=png&data=${encodeURIComponent(url)}`;
  try {
    const response = await fetch(source);
    if (!response.ok) throw new Error("QR image could not be downloaded.");
    const blob = await response.blob();
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${String(title || "registration").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-qr.png`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  } catch {
    window.open(source, "_blank", "noopener,noreferrer");
  }
  setSaveMessage("Registration QR code prepared.");
}

export default function RegistrationCampaigns({
  campaigns = [],
  postedForms = [],
  scoutYears = [],
  onEdit,
  onRefresh,
  setSaveMessage,
  searchQuery = ""
}) {
  const search = searchQuery.trim().toLowerCase();
  const visible = campaigns.filter((campaign) => {
    const form = postedForms.find((item) => item.id === campaign.postedFormId);
    return !search || [campaign.settings.registrationTitle, campaign.settings.slug, campaign.status, form?.title]
      .some((value) => String(value ?? "").toLowerCase().includes(search));
  });
  const seasonName = (id) => scoutYears.find((year) => year.id === id)?.label ?? "Season not found";
  const updateStatus = async (campaign, status) => {
    await setRegistrationCampaignStatus(campaign.id, status);
    setSaveMessage(`Registration campaign ${status}.`);
    await onRefresh();
  };

  return (
    <section className="registration-campaigns-page">
      <div className="registration-section-heading">
        <div><p className="eyebrow">Public registration</p><h2>Registration Campaigns</h2></div>
        <p>Manage the public link and availability while the existing Forms builder controls every question.</p>
      </div>
      <div className="registration-campaign-grid">
        {visible.length ? visible.map((campaign) => {
          const form = postedForms.find((item) => item.id === campaign.postedFormId);
          const url = publicRegistrationUrl(campaign.settings.slug);
          return (
            <article className="registration-campaign-card" key={campaign.id}>
              <header>
                <span className={`registration-status ${campaign.status}`}>{campaign.status.replaceAll("_", " ")}</span>
                <ShieldCheck size={20} aria-hidden="true" />
              </header>
              <div>
                <h3>{campaign.settings.registrationTitle || form?.title || "Scout Registration"}</h3>
                <p>{seasonName(campaign.settings.seasonId)}</p>
                <code>/register/{campaign.settings.slug}</code>
              </div>
              <dl>
                <div><dt>Returning</dt><dd>{campaign.settings.returningEnabled ? "Enabled" : "Disabled"}</dd></div>
                <div><dt>New scouts</dt><dd>{campaign.settings.newEnabled ? "Enabled" : "Disabled"}</dd></div>
                <div><dt>Capacity</dt><dd>{campaign.settings.capacity ?? "Unlimited"}</dd></div>
              </dl>
              <div className="registration-campaign-actions">
                <button type="button" className="inline-action" onClick={() => copyLink(url, setSaveMessage)}><Copy size={16} />Copy Link</button>
                <a className="inline-action" href={url} target="_blank" rel="noreferrer"><ExternalLink size={16} />Open</a>
                <button type="button" className="inline-action" onClick={() => downloadQr(url, campaign.settings.registrationTitle, setSaveMessage)}><QrCode size={16} />QR Code</button>
                <button type="button" className="inline-action" onClick={() => onEdit(form)} disabled={!form}><FilePenLine size={16} />Edit Form</button>
                {campaign.status === "open"
                  ? <button type="button" className="inline-action" onClick={() => updateStatus(campaign, "paused")}><Pause size={16} />Pause</button>
                  : <button type="button" className="inline-action" onClick={() => updateStatus(campaign, "open")}><Play size={16} />Open</button>}
                <button type="button" className="inline-action" onClick={() => updateStatus(campaign, "closed")}>Close</button>
                <button type="button" className="inline-action danger-action" onClick={() => updateStatus(campaign, "archived")}>Archive</button>
              </div>
            </article>
          );
        }) : <article className="registration-empty-state"><ShieldCheck size={30} /><h3>No registration campaigns</h3><p>Create a form and choose Scout Registration as its purpose.</p></article>}
      </div>
    </section>
  );
}
