import { Link } from "react-router-dom";
import { hasHtmlMarkup, sanitizeRichHtml } from "../utils/richText.js";

function isSafeHref(href) {
  return /^(https?:\/\/|mailto:|tel:|\/)/i.test(String(href ?? ""));
}

function renderInline(text, keyPrefix) {
  const parts = [];
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let cursor = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      parts.push(text.slice(cursor, match.index));
    }

    if (match[2] && match[3]) {
      const label = match[2];
      const href = match[3].trim();
      if (isSafeHref(href)) {
        parts.push(href.startsWith("/") ? (
          <Link key={`${keyPrefix}-link-${match.index}`} to={href}>{label}</Link>
        ) : (
          <a key={`${keyPrefix}-link-${match.index}`} href={href} target="_blank" rel="noreferrer">{label}</a>
        ));
      } else {
        parts.push(label);
      }
    } else if (match[4]) {
      parts.push(<strong key={`${keyPrefix}-bold-${match.index}`}>{match[4]}</strong>);
    } else if (match[5]) {
      parts.push(<em key={`${keyPrefix}-italic-${match.index}`}>{match[5]}</em>);
    } else if (match[6]) {
      parts.push(<code key={`${keyPrefix}-code-${match.index}`}>{match[6]}</code>);
    }

    cursor = pattern.lastIndex;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts.length ? parts : text;
}

export default function FormattedText({ text, fallback = "", className = "formatted-text" }) {
  const value = String(text || fallback || "").trim();

  if (!value) {
    return null;
  }

  if (hasHtmlMarkup(value)) {
    return <div className={className} dir="auto" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(value) }} />;
  }

  const blocks = [];
  const bulletItems = [];
  const flushBullets = () => {
    if (!bulletItems.length) return;
    const items = bulletItems.splice(0);
    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {items.map((item, index) => <li key={index}>{renderInline(item, `li-${blocks.length}-${index}`)}</li>)}
      </ul>
    );
  };

  value.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushBullets();
      return;
    }

    if (trimmed.startsWith("- ")) {
      bulletItems.push(trimmed.slice(2));
      return;
    }

    flushBullets();

    if (trimmed.startsWith("### ")) {
      blocks.push(<h4 key={index}>{renderInline(trimmed.slice(4), `h4-${index}`)}</h4>);
    } else if (trimmed.startsWith("## ")) {
      blocks.push(<h3 key={index}>{renderInline(trimmed.slice(3), `h3-${index}`)}</h3>);
    } else if (trimmed.startsWith("# ")) {
      blocks.push(<h2 key={index}>{renderInline(trimmed.slice(2), `h2-${index}`)}</h2>);
    } else {
      blocks.push(<p key={index}>{renderInline(trimmed, `p-${index}`)}</p>);
    }
  });

  flushBullets();

  return <div className={className} dir="auto">{blocks}</div>;
}



