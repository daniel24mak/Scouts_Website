import { PDF_PROCESSING_OPTIONS, REGISTRATION_FILE_FORMATS, REGISTRATION_STORAGE_CATEGORIES, normalizeUploadQuestion } from "./registrationModel.js";

const pdfLabels = {
  keep_original: "Keep original PDF",
  compress: "Compress PDF",
  original_and_compressed: "Keep original and compressed copy",
  original_and_previews: "Keep original and create WebP previews",
  previews_only: "Convert pages to WebP only"
};

export default function UploadQuestionSettings({ question, onChange }) {
  const settings = normalizeUploadQuestion(question);
  const hasKnownStorageCategory = REGISTRATION_STORAGE_CATEGORIES.some(([value]) => value === settings.storageCategory);
  const update = (patch) => onChange({ ...settings, ...patch });
  const toggleFormat = (format, checked) => update({
    acceptedFormats: checked
      ? [...new Set([...settings.acceptedFormats, format])]
      : settings.acceptedFormats.filter((item) => item !== format)
  });

  return (
    <div className="forms-upload-question-settings">
      <div className="inline-editor-grid">
        <label>Maximum files<input type="number" min="1" max="10" value={settings.maxFiles} onChange={(event) => update({ maxFiles: Number(event.target.value) })} /></label>
        <label>Maximum size per file (MB)<input type="number" min="1" max="20" value={settings.maxFileSizeMb} onChange={(event) => update({ maxFileSizeMb: Number(event.target.value) })} /></label>
        <label>Document purpose<select value={settings.storageCategory} onChange={(event) => update({ storageCategory: event.target.value })}>{!hasKnownStorageCategory && <option value={settings.storageCategory}>{settings.storageCategory}</option>}{REGISTRATION_STORAGE_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Image processing<select value={settings.imageCompression} onChange={(event) => update({ imageCompression: event.target.value })}><option value="none">Keep original</option><option value="document">Readable document WebP</option><option value="headshot">Portrait headshot WebP</option></select></label>
      </div>
      <fieldset><legend>Accepted formats</legend><div className="forms-format-picker">{REGISTRATION_FILE_FORMATS.map((format) => <label key={format}><input type="checkbox" checked={settings.acceptedFormats.includes(format)} onChange={(event) => toggleFormat(format, event.target.checked)} />{format.toUpperCase()}</label>)}</div></fieldset>
      {settings.acceptedFormats.includes("pdf") && <label>PDF processing<select value={settings.pdfProcessing} onChange={(event) => update({ pdfProcessing: event.target.value })}>{PDF_PROCESSING_OPTIONS.map((option) => <option key={option} value={option}>{pdfLabels[option]}</option>)}</select></label>}
      <label>Upload instructions<textarea value={settings.uploadInstructions} onChange={(event) => update({ uploadInstructions: event.target.value })} placeholder="Make sure every edge is visible and all details are readable." /></label>
      <div className="registration-toggle-grid">
        <label className="toggle-row"><input type="checkbox" checked={settings.privateClassification === "protected"} onChange={(event) => update({ privateClassification: event.target.checked ? "protected" : "private" })} />Protected classification</label>
        <label className="toggle-row"><input type="checkbox" checked={settings.requiresVerification} onChange={(event) => update({ requiresVerification: event.target.checked })} />Requires verification</label>
      </div>
    </div>
  );
}
