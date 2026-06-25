import { ArrowDown, ArrowUp, GripVertical, ImagePlus, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import FormattedText from "./FormattedText.jsx";
import RichTextEditor from "./RichTextEditor.jsx";

const makeId = (prefix) => `${prefix}-${crypto.randomUUID()}`;

const homeSections = [
  { id: "hero", title: "Hero Section", fields: [
    ["home_hero_image", "Background image", "image", "hero"],
    ["home_hero_title", "Headline", "text"],
    ["home_hero_subtitle", "Subheading", "rich"],
    ["home_hero_cta_text", "CTA button text", "text"],
    ["home_hero_cta_link", "CTA destination", "text"]
  ] },
  { id: "about", title: "About Us Snippet", fields: [
    ["home_about_text", "Snippet paragraph", "rich"],
    ["home_about_image", "Snippet image", "image", "card"]
  ] },
  { id: "events", title: "Upcoming Events", fields: [
    ["home_events_heading", "Section heading", "text"],
    ["home_events_subtitle", "Section subtitle", "rich"]
  ] },
  { id: "blogs", title: "Latest News / Blogs", fields: [
    ["home_blogs_heading", "Section heading", "text"],
    ["home_blogs_subtitle", "Section subtitle", "rich"]
  ] },
  { id: "albums", title: "Newly Added Albums", fields: [
    ["home_albums_heading", "Section heading", "text"],
    ["home_albums_subtitle", "Section subtitle", "rich"]
  ] },
  { id: "contact", title: "Contact Section", fields: [
    ["home_contact_heading", "Heading", "text"],
    ["home_contact_intro", "Intro text", "rich"],
    ["home_contact_email", "Email", "text"],
    ["home_contact_phone", "Phone", "text"],
    ["home_contact_location", "Location", "text"]
  ] }
];

const aboutSections = [
  { id: "banner", title: "Banner", fields: [
    ["about_hero_image", "Banner image", "image", "hero"],
    ["about_page_title", "Page title", "text"]
  ] },
  { id: "story", title: "Our Story", fields: [
    ["about_intro_text", "Story paragraph", "rich"],
    ["about_intro_image", "Story image", "image", "card"]
  ] },
  { id: "history", title: "History Introduction", fields: [
    ["about_history_text", "History text", "rich"]
  ] },
  { id: "mission", title: "Mission Statement", fields: [
    ["about_mission_text", "Mission text", "rich"]
  ] }
];

function move(items, index, direction) {
  const next = index + direction;
  if (next < 0 || next >= items.length) return items;
  const copy = [...items];
  [copy[index], copy[next]] = [copy[next], copy[index]];
  return copy;
}

function ReorderCard({ children, index, total, onMove, onDelete, onDragStart, onDrop, label }) {
  return <article className="website-list-card" draggable onDragStart={onDragStart} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
    <div className="website-list-card-tools">
      <span className="forms-drag-handle" title={`Drag ${label}`}><GripVertical size={19} /></span>
      <button type="button" className="icon-button" title="Move up" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={16} /></button>
      <button type="button" className="icon-button" title="Move down" disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown size={16} /></button>
      <button type="button" className="icon-button danger-action" title={`Delete ${label}`} onClick={onDelete}><Trash2 size={16} /></button>
    </div>
    <div className="website-list-card-fields">{children}</div>
  </article>;
}

function ImageField({ label, image, shape = "square", onChoose }) {
  return <label className={`website-content-image-control ${shape}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onChoose(event.dataTransfer.files?.[0] ?? null); }}>
    <span>{label}</span>
    <div>{image ? <img src={image} alt="" /> : <span><ImagePlus size={25} />Drop or choose image</span>}</div>
    <input type="file" accept="image/*,.heic,.heif" onChange={(event) => { onChoose(event.target.files?.[0] ?? null); event.target.value = ""; }} />
  </label>;
}

function FieldEditor({ field, value, image, onChange, onChooseImage }) {
  const [key, label, type, imageShape] = field;
  if (type === "image") return <ImageField label={label} image={image} shape={imageShape} onChoose={(file) => onChooseImage(file, key, imageShape)} />;
  if (type === "rich") return <RichTextEditor label={label} value={value} onChange={(next) => onChange(key, next)} minHeight={115} />;
  return <label className="forms-field-label">{label}<input value={value} onChange={(event) => onChange(key, event.target.value)} /></label>;
}

function SectionPreview({ section, valueFor, imageFor }) {
  const values = Object.fromEntries(section.fields.map(([key]) => [key, valueFor(key)]));
  const imageField = section.fields.find(([, , type]) => type === "image");
  const image = imageField ? imageFor(imageField[0]) : "";
  return <div className={`website-live-snippet preview-${section.id}`}>
    {image && <img src={image} alt="" />}
    <div>
      <p className="eyebrow">{section.title}</p>
      {section.fields.filter(([, , type]) => type !== "image").map(([key, label, type], index) => index === 0
        ? <h3 key={key}>{values[key] || label}</h3>
        : type === "rich" ? <FormattedText key={key} text={values[key]} fallback={label} /> : <p key={key}>{values[key] || label}</p>)}
    </div>
  </div>;
}

function parseList(value, fallback) {
  if (!value) return fallback;
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : fallback; } catch { return fallback; }
}

export default function WebsiteContentEditor({ data, page, onPageChange, valueFor, imageFor, onFieldChange, onChooseImage, onCollectionsChange, imageFiles }) {
  const [faqs, setFaqs] = useState(() => (data.faqs ?? []).map((item) => ({ ...item })));
  const [leaders, setLeaders] = useState(() => (data.leaders ?? []).map((item) => ({ ...item })));
  const [dragState, setDragState] = useState(null);
  const timeline = useMemo(() => parseList(valueFor("about_history_milestones"), [{ id: makeId("timeline"), year: "", title: "", text: "" }]), [valueFor("about_history_milestones")]);
  const values = useMemo(() => parseList(valueFor("about_values"), [{ id: makeId("value"), icon: "Compass", name: "Faith", description: "" }]), [valueFor("about_values")]);
  const groups = useMemo(() => parseList(valueFor("about_scout_groups"), [{ id: makeId("group"), name: "", ageRange: "", description: "" }]), [valueFor("about_scout_groups")]);

  const commitFaqs = (next) => { setFaqs(next); onCollectionsChange({ faqs: next }); };
  const commitLeaders = (next) => { setLeaders(next); onCollectionsChange({ leaders: next }); };

  const updateJsonList = (key, list) => onFieldChange(key, JSON.stringify(list));
  const dropList = (kind, list, toIndex, setter) => {
    if (!dragState || dragState.kind !== kind || dragState.index === toIndex) return;
    const copy = [...list];
    const [item] = copy.splice(dragState.index, 1);
    copy.splice(toIndex, 0, item);
    setter(copy);
    setDragState(null);
  };
  const renderJsonList = (kind, key, list, fields, addLabel, blank) => <div className="website-repeatable-list">
    {list.map((item, index) => <ReorderCard key={item.id ?? index} index={index} total={list.length} label={addLabel} onDragStart={() => setDragState({ kind, index })} onDrop={() => dropList(kind, list, index, (next) => updateJsonList(key, next))} onMove={(direction) => updateJsonList(key, move(list, index, direction))} onDelete={() => { if (window.confirm(`Delete this ${addLabel.toLowerCase()}?`)) updateJsonList(key, list.filter((_, itemIndex) => itemIndex !== index)); }}>
      {fields.map(([name, label, type]) => type === "textarea" ? <label key={name}>{label}<textarea rows="3" value={item[name] ?? ""} onChange={(event) => updateJsonList(key, list.map((entry, itemIndex) => itemIndex === index ? { ...entry, [name]: event.target.value } : entry))} /></label> : type === "select" ? <label key={name}>{label}<select value={item[name] ?? "Compass"} onChange={(event) => updateJsonList(key, list.map((entry, itemIndex) => itemIndex === index ? { ...entry, [name]: event.target.value } : entry))}>{["Compass", "HeartHandshake", "ShieldCheck", "Sparkles", "Users", "Church", "Flag", "Star"].map((option) => <option key={option}>{option}</option>)}</select></label> : <label key={name}>{label}<input value={item[name] ?? ""} onChange={(event) => updateJsonList(key, list.map((entry, itemIndex) => itemIndex === index ? { ...entry, [name]: event.target.value } : entry))} /></label>)}
    </ReorderCard>)}
    <button type="button" className="inline-action" onClick={() => updateJsonList(key, [...list, { id: makeId(kind), ...blank }])}><Plus size={16} />Add {addLabel}</button>
  </div>;

  const sections = page === "home" ? homeSections : aboutSections;
  return <div className="website-content-builder">
    <div className="approval-type-tabs website-page-tabs">
      {[['home', 'Home'], ['about', 'About']].map(([id, label]) => <button type="button" className={page === id ? "active" : ""} onClick={() => onPageChange(id)} key={id}>{label}</button>)}
    </div>
    <div className="website-content-section-stack">
      {sections.map((section) => <section className="website-content-builder-section" key={section.id}>
        <div className="website-content-form-column"><div className="website-content-section-heading"><p className="eyebrow">{page}</p><h3>{section.title}</h3></div>{section.fields.map((field) => <FieldEditor key={field[0]} field={field} value={valueFor(field[0])} image={imageFor(field[0])} onChange={onFieldChange} onChooseImage={onChooseImage} />)}</div>
        <aside className="website-content-preview-column"><span>Live preview</span><SectionPreview section={section} valueFor={valueFor} imageFor={imageFor} /></aside>
      </section>)}

      {page === "home" && <section className="website-content-builder-section"><div className="website-content-form-column"><div className="website-content-section-heading"><p className="eyebrow">Home</p><h3>FAQ Section</h3></div><div className="website-repeatable-list">{faqs.map((faq, index) => <ReorderCard key={faq.id} index={index} total={faqs.length} label="FAQ" onDragStart={() => setDragState({ kind: "faq", index })} onDrop={() => dropList("faq", faqs, index, commitFaqs)} onMove={(direction) => commitFaqs(move(faqs, index, direction))} onDelete={() => { if (window.confirm("Delete this FAQ?")) commitFaqs(faqs.filter((_, itemIndex) => itemIndex !== index)); }}><label>Question<input value={faq.question ?? ""} onChange={(event) => commitFaqs(faqs.map((item, itemIndex) => itemIndex === index ? { ...item, question: event.target.value } : item))} /></label><RichTextEditor label="Answer" value={faq.answer ?? ""} onChange={(answer) => commitFaqs(faqs.map((item, itemIndex) => itemIndex === index ? { ...item, answer } : item))} minHeight={100} /></ReorderCard>)}<button type="button" className="inline-action" onClick={() => commitFaqs([...faqs, { id: makeId("faq"), question: "", answer: "", isNew: true, isActive: true }])}><Plus size={16} />Add FAQ</button></div></div><aside className="website-content-preview-column"><span>Live preview</span><div className="faq-list website-live-snippet">{faqs.slice(0, 4).map((faq) => <article className="faq-item open" key={faq.id}><button type="button"><span>{faq.question || "FAQ question"}</span></button><div className="faq-answer"><FormattedText text={faq.answer} fallback="FAQ answer" /></div></article>)}</div></aside></section>}

      {page === "about" && <>
        <section className="website-content-builder-section"><div className="website-content-form-column"><div className="website-content-section-heading"><p className="eyebrow">About</p><h3>History Timeline</h3></div>{renderJsonList("timeline", "about_history_milestones", timeline, [["year", "Year"], ["title", "Title"], ["text", "Description", "textarea"]], "Timeline Entry", { year: "", title: "", text: "" })}</div><aside className="website-content-preview-column"><span>Live preview</span><div className="about-history-timeline website-live-snippet">{timeline.map((item) => <article key={item.id}><strong>{item.year || "Year"}</strong><h3>{item.title || "Milestone"}</h3><p>{item.text || "Description"}</p></article>)}</div></aside></section>
        <section className="website-content-builder-section"><div className="website-content-form-column"><div className="website-content-section-heading"><p className="eyebrow">About</p><h3>Mission & Values</h3></div>{renderJsonList("value", "about_values", values, [["icon", "Icon", "select"], ["name", "Value name"], ["description", "Description", "textarea"]], "Value", { icon: "Compass", name: "", description: "" })}</div><aside className="website-content-preview-column"><span>Live preview</span><div className="goal-grid website-live-snippet">{values.map((item) => <article className="goal-card" key={item.id}><h3>{item.name || "Value"}</h3><p>{item.description || "Description"}</p></article>)}</div></aside></section>
        <section className="website-content-builder-section"><div className="website-content-form-column"><div className="website-content-section-heading"><p className="eyebrow">About</p><h3>Scout Groups</h3></div>{renderJsonList("group", "about_scout_groups", groups, [["name", "Group name"], ["ageRange", "Age or grade range"], ["description", "Description", "textarea"]], "Scout Group", { name: "", ageRange: "", description: "" })}</div><aside className="website-content-preview-column"><span>Live preview</span><div className="about-group-strip website-live-snippet">{groups.map((item) => <article className="about-group-card" key={item.id}><h3>{item.name || "Group"}</h3><span>{item.ageRange || "Range"}</span><p>{item.description}</p></article>)}</div></aside></section>
        <section className="website-content-builder-section"><div className="website-content-form-column"><div className="website-content-section-heading"><p className="eyebrow">About</p><h3>Leaders</h3></div><div className="website-repeatable-list">{leaders.map((leader, index) => <ReorderCard key={leader.id} index={index} total={leaders.length} label="Leader" onDragStart={() => setDragState({ kind: "leader", index })} onDrop={() => dropList("leader", leaders, index, commitLeaders)} onMove={(direction) => commitLeaders(move(leaders, index, direction))} onDelete={() => { if (window.confirm("Delete this leader?")) commitLeaders(leaders.filter((_, itemIndex) => itemIndex !== index)); }}><ImageField label="Photo" shape="circle" image={imageFor(`leader:${leader.id}`) || leader.photoUrl} onChoose={(file) => { commitLeaders(leaders); onChooseImage(file, `leader:${leader.id}`, "circle"); }} /><label>Name<input value={leader.name ?? ""} onChange={(event) => commitLeaders(leaders.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /></label><label>Role<input value={leader.title ?? ""} onChange={(event) => commitLeaders(leaders.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))} /></label></ReorderCard>)}<button type="button" className="inline-action" onClick={() => commitLeaders([...leaders, { id: makeId("leader"), name: "", title: "", photoUrl: "", storagePath: "", isNew: true, isActive: true }])}><Plus size={16} />Add Leader</button></div></div><aside className="website-content-preview-column"><span>Live preview</span><div className="leaders-grid website-live-snippet">{leaders.map((leader) => <article className="leader-card" key={leader.id}>{(imageFor(`leader:${leader.id}`) || leader.photoUrl) && <img src={imageFor(`leader:${leader.id}`) || leader.photoUrl} alt="" />}<h3>{leader.name || "Leader name"}</h3><span>{leader.title || "Role"}</span></article>)}</div></aside></section>
      </>}
    </div>
  </div>;
}