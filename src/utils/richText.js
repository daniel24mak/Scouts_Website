import DOMPurify from "dompurify";

const allowedTags = [
  "a",
  "blockquote",
  "br",
  "code",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "sub",
  "sup",
  "u",
  "ul"
];

const allowedAttributes = ["class", "dir", "href", "lang", "rel", "style", "target"];
const allowedCssProperties = new Set([
  "background-color",
  "color",
  "direction",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "text-align",
  "text-decoration",
  "unicode-bidi"
]);

export function isSafeUrl(url) {
  return /^(https?:\/\/|mailto:|tel:|\/)/i.test(String(url ?? "").trim());
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanStyle(styleValue) {
  return String(styleValue ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [property, ...valueParts] = part.split(":");
      const propertyName = property?.trim().toLowerCase();
      const propertyValue = valueParts.join(":").replace(/!important/gi, "").trim();

      if (!propertyName || !propertyValue || !allowedCssProperties.has(propertyName)) return "";
      if (/url\s*\(|expression\s*\(/i.test(propertyValue)) return "";

      return `${propertyName}: ${propertyValue}`;
    })
    .filter(Boolean)
    .join("; ");
}

function normalizeHtml(html) {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html;
  }

  const document = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = document.body.firstElementChild;

  root.querySelectorAll("b").forEach((node) => {
    const replacement = document.createElement("strong");
    replacement.innerHTML = node.innerHTML;
    [...node.attributes].forEach((attribute) => replacement.setAttribute(attribute.name, attribute.value));
    node.replaceWith(replacement);
  });

  root.querySelectorAll("i").forEach((node) => {
    const replacement = document.createElement("em");
    replacement.innerHTML = node.innerHTML;
    [...node.attributes].forEach((attribute) => replacement.setAttribute(attribute.name, attribute.value));
    node.replaceWith(replacement);
  });

  root.querySelectorAll("a").forEach((link) => {
    const href = link.getAttribute("href");
    if (!isSafeUrl(href)) {
      link.removeAttribute("href");
      return;
    }

    if (!href.startsWith("/")) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer nofollow");
    }
  });

  root.querySelectorAll("[style]").forEach((node) => {
    const style = cleanStyle(node.getAttribute("style"));
    if (style) node.setAttribute("style", style);
    else node.removeAttribute("style");
  });

  return root.innerHTML;
}

export function sanitizeRichHtml(html) {
  const value = String(html ?? "").trim();

  if (!value) {
    return "";
  }

  const normalized = normalizeHtml(value);

  return DOMPurify.sanitize(normalized, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttributes,
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ["iframe", "script", "style", "object", "embed", "form", "input", "button"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "srcdoc"],
    ADD_ATTR: ["target", "rel"]
  });
}


function marksToAttributes(marks = []) {
  const attrs = {};

  marks.forEach((mark) => {
    if (mark?.type === "link" && isSafeUrl(mark.attrs?.href)) {
      attrs.href = mark.attrs.href;
    }
  });

  return attrs;
}

function renderMarkedText(text, marks = []) {
  let html = escapeHtml(text);
  const attrs = marksToAttributes(marks);

  marks.forEach((mark) => {
    if (mark?.type === "bold") html = `<strong>${html}</strong>`;
    if (mark?.type === "italic") html = `<em>${html}</em>`;
    if (mark?.type === "underline") html = `<u>${html}</u>`;
    if (mark?.type === "strike") html = `<s>${html}</s>`;
    if (mark?.type === "code") html = `<code>${html}</code>`;
  });

  if (attrs.href) {
    html = `<a href="${escapeHtml(attrs.href)}">${html}</a>`;
  }

  return html;
}

function renderRichTextNode(node) {
  if (!node) return "";
  if (Array.isArray(node)) return node.map(renderRichTextNode).join("");
  if (typeof node === "string") return escapeHtml(node);
  if (typeof node !== "object") return escapeHtml(String(node ?? ""));
  if (typeof node.html === "string") return node.html;
  if (typeof node.textValue === "string") return node.textValue;
  if (typeof node.value === "string") return node.value;
  if (typeof node.text === "string") return renderMarkedText(node.text, node.marks);

  const children = renderRichTextNode(node.content ?? node.children ?? []);
  const textAlign = node.attrs?.textAlign ? ` style="text-align: ${escapeHtml(node.attrs.textAlign)}"` : "";

  switch (node.type) {
    case "doc":
      return children;
    case "paragraph":
      return `<p${textAlign}>${children || "<br>"}</p>`;
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 2)));
      return `<h${level}${textAlign}>${children}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${children}</ul>`;
    case "orderedList":
      return `<ol>${children}</ol>`;
    case "listItem":
      return `<li>${children}</li>`;
    case "blockquote":
      return `<blockquote>${children}</blockquote>`;
    case "hardBreak":
      return "<br>";
    default:
      return children;
  }
}

export function normalizeRichTextInput(value) {
  if (value == null) return "";
  if (typeof value === "object") return sanitizeRichHtml(renderRichTextNode(value));

  const text = String(value).trim();
  if (!text) return "";

  const looksJson = (text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"));
  if (!looksJson) return text;

  try {
    const parsed = JSON.parse(text);
    const html = renderRichTextNode(parsed);
    return sanitizeRichHtml(html || "");
  } catch {
    return text;
  }
}
export function hasHtmlMarkup(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value ?? ""));
}

function inlineTextToHtml(value) {
  return escapeHtml(value)
    .replace(/(https?:\/\/[^\s<]+)/gi, '<a href="$1">$1</a>')
    .replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>")
    .replace(/_([^_\n]+)_/g, "<em>$1</em>")
    .replace(/~([^~\n]+)~/g, "<s>$1</s>");
}

export function textToRichHtml(value) {
  const text = String(value ?? "").replace(/\r\n/g, "\n").trim();

  if (!text) {
    return "";
  }

  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.split("\n").map(inlineTextToHtml).join("<br>")}</p>`)
    .join("");
}

export function richTextToPlainText(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  const document = new DOMParser().parseFromString(hasHtmlMarkup(text) ? sanitizeRichHtml(text) : textToRichHtml(text), "text/html");
  return document.body.textContent.replace(/\s+/g, " ").trim();
}