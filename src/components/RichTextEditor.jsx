import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Palette,
  RemoveFormatting,
  Type,
  Underline
} from "lucide-react";
import { Extension } from "@tiptap/core";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import UnderlineExtension from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { sanitizeRichHtml } from "../utils/richText.js";

const fontOptions = ["Arial", "Georgia", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana"];
const fontSizes = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];
const colorOptions = ["#111827", "#4055a6", "#f5bf15", "#2f7d6d", "#dc2626", "#ffffff"];
const highlightOptions = ["#fff3a3", "#dbeafe", "#dcfce7", "#fee2e2", "#f5f5f5", "#ffffff"];

const FontSize = Extension.create({
  name: "fontSize",

  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            }
          }
        }
      }
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run()
    };
  }
});

export default function RichTextEditor({ value, onChange, label, required = false, minHeight = 180, placeholder = "Write formatted text..." }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] }
      }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      UnderlineExtension,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer nofollow"
        }
      }),
      Placeholder.configure({ placeholder })
    ],
    content: sanitizeRichHtml(value || ""),
    editorProps: {
      attributes: {
        class: "rich-text-input",
        dir: "auto",
        style: `min-height: ${minHeight}px`
      }
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChange(sanitizeRichHtml(currentEditor.getHTML()));
    }
  });

  useEffect(() => {
    if (!editor || editor.isFocused) return;

    const cleanValue = sanitizeRichHtml(value || "");
    if (editor.getHTML() !== cleanValue) {
      editor.commands.setContent(cleanValue, false);
    }
  }, [editor, value]);

  const run = (callback) => {
    if (!editor) return;
    callback(editor.chain().focus()).run();
  };

  const setLink = () => {
    if (!editor) return;

    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Paste a link URL. Use /blogs/post-slug for internal links.", previousUrl || "");

    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  if (!editor) return null;

  return (
    <div className="rich-text-field">
      {label && <span>{label}{required ? " *" : ""}</span>}
      <div className="rich-text-editor">
        <div className="rich-text-toolbar" aria-label={`${label ?? "Text"} formatting toolbar`}>
          <button type="button" className={editor.isActive("bold") ? "is-active" : ""} title="Bold" aria-label="Bold" onClick={() => run((chain) => chain.toggleBold())}><Bold size={17} /></button>
          <button type="button" className={editor.isActive("italic") ? "is-active" : ""} title="Italic" aria-label="Italic" onClick={() => run((chain) => chain.toggleItalic())}><Italic size={17} /></button>
          <button type="button" className={editor.isActive("underline") ? "is-active" : ""} title="Underline" aria-label="Underline" onClick={() => run((chain) => chain.toggleUnderline())}><Underline size={17} /></button>
          <select title="Paragraph style" aria-label="Paragraph style" value={editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : editor.isActive("heading", { level: 4 }) ? "h4" : "p"} onChange={(event) => {
            const block = event.target.value;
            if (block === "p") run((chain) => chain.setParagraph());
            if (block === "h2") run((chain) => chain.toggleHeading({ level: 2 }));
            if (block === "h3") run((chain) => chain.toggleHeading({ level: 3 }));
            if (block === "h4") run((chain) => chain.toggleHeading({ level: 4 }));
          }}>
            <option value="p">Paragraph</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="h4">Heading 4</option>
          </select>
          <select title="Font" aria-label="Font" defaultValue="" onChange={(event) => event.target.value ? run((chain) => chain.setFontFamily(event.target.value)) : run((chain) => chain.unsetFontFamily())}>
            <option value="">Font</option>
            {fontOptions.map((font) => <option value={font} key={font}>{font}</option>)}
          </select>
          <select title="Font size" aria-label="Font size" defaultValue="" onChange={(event) => event.target.value ? run((chain) => chain.setFontSize(event.target.value)) : run((chain) => chain.unsetFontSize())}>
            <option value=""><Type size={14} /> Size</option>
            {fontSizes.map((size) => <option value={size} key={size}>{size.replace("px", "")}</option>)}
          </select>
          <span className="rich-color-control" title="Text color" aria-label="Text color">
            <Palette size={17} />
            <input type="color" list="rich-text-colors" defaultValue={colorOptions[0]} onInput={(event) => run((chain) => chain.setColor(event.currentTarget.value))} />
          </span>
          <span className="rich-color-control" title="Highlight" aria-label="Highlight">
            <Highlighter size={17} />
            <input type="color" list="rich-highlight-colors" defaultValue={highlightOptions[0]} onInput={(event) => run((chain) => chain.toggleHighlight({ color: event.currentTarget.value }))} />
          </span>
          <button type="button" className={editor.isActive({ textAlign: "left" }) ? "is-active" : ""} title="Align left" aria-label="Align left" onClick={() => run((chain) => chain.setTextAlign("left"))}><AlignLeft size={17} /></button>
          <button type="button" className={editor.isActive({ textAlign: "center" }) ? "is-active" : ""} title="Align center" aria-label="Align center" onClick={() => run((chain) => chain.setTextAlign("center"))}><AlignCenter size={17} /></button>
          <button type="button" className={editor.isActive({ textAlign: "right" }) ? "is-active" : ""} title="Align right" aria-label="Align right" onClick={() => run((chain) => chain.setTextAlign("right"))}><AlignRight size={17} /></button>
          <button type="button" className={editor.isActive("link") ? "is-active" : ""} title="Insert or edit link" aria-label="Insert or edit link" onClick={setLink}><LinkIcon size={17} /></button>
          <button type="button" className={editor.isActive("bulletList") ? "is-active" : ""} title="Bulleted list" aria-label="Bulleted list" onClick={() => run((chain) => chain.toggleBulletList())}><List size={17} /></button>
          <button type="button" className={editor.isActive("orderedList") ? "is-active" : ""} title="Numbered list" aria-label="Numbered list" onClick={() => run((chain) => chain.toggleOrderedList())}><ListOrdered size={17} /></button>
          <button type="button" title="Clear formatting" aria-label="Clear formatting" onClick={() => run((chain) => chain.unsetAllMarks().clearNodes())}><RemoveFormatting size={17} /></button>
        </div>
        <EditorContent editor={editor} />
      </div>
      <datalist id="rich-text-colors">
        {colorOptions.map((color) => <option value={color} key={color} />)}
      </datalist>
      <datalist id="rich-highlight-colors">
        {highlightOptions.map((color) => <option value={color} key={color} />)}
      </datalist>
    </div>
  );
}