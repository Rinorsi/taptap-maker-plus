import Mention from "@tiptap/extension-mention";
import { EditorContent, ReactRenderer, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type MutableRefObject } from "react";
import { cn } from "../../lib/utils";
import { describeAssetUse, type CanvasAssetReference, type CanvasMentionToken } from "../canvas-core";

type MentionItem = {
  id: string;
  label: string;
  alias: string;
  nodeId: string;
  kind: CanvasAssetReference["kind"];
  use: CanvasAssetReference["use"];
  description: string;
  broken?: boolean;
};

type MentionListHandle = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
};

function toMentionItem(reference: CanvasAssetReference): MentionItem {
  return {
    id: reference.nodeId,
    label: reference.alias,
    alias: reference.alias,
    nodeId: reference.nodeId,
    kind: reference.kind,
    use: reference.use,
    description: reference.fileName || reference.relativePath || describeAssetUse(reference.use),
  };
}

const MentionList = forwardRef<MentionListHandle, {
  items: MentionItem[];
  command: (item: MentionItem) => void;
}>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  useEffect(() => setSelectedIndex(0), [items]);
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((index) => (index + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((index) => (index + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        if (items[selectedIndex]) command(items[selectedIndex]);
        return true;
      }
      return false;
    },
  }), [command, items, selectedIndex]);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border-soft bg-surface-panel px-3 py-2 text-xs text-text-muted shadow-popover">
        没有可引用素材
      </div>
    );
  }

  return (
    <div className="min-w-[220px] overflow-hidden rounded-lg border border-border-soft bg-surface-panel p-1 shadow-popover">
      {items.map((item, index) => (
        <button
          key={item.nodeId}
          type="button"
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-xs",
            index === selectedIndex ? "bg-brand/12 text-brand" : "text-text hover:bg-surface-raised",
            item.broken && "text-yellow-600",
          )}
          onMouseDown={(event) => {
            event.preventDefault();
            command(item);
          }}
        >
          <span className="font-bold">@{item.alias}</span>
          <span className="min-w-0 truncate text-[10px] text-text-subtle">
            {describeAssetUse(item.use)}
          </span>
        </button>
      ))}
    </div>
  );
});
MentionList.displayName = "MentionList";

function createMentionSuggestion(references: CanvasAssetReference[]) {
  return {
    char: "@",
    items: ({ query }: { query: string }) =>
      references
        .map(toMentionItem)
        .filter((item) => {
          const keyword = query.trim().toLowerCase();
          if (!keyword) return true;
          return (
            item.alias.toLowerCase().includes(keyword) ||
            item.description.toLowerCase().includes(keyword) ||
            item.kind.toLowerCase().includes(keyword)
          );
        })
        .slice(0, 12),
    render: () => {
      let component: ReactRenderer<MentionListHandle> | null = null;
      let popup: HTMLDivElement | null = null;

      const updatePopupPosition = (props: SuggestionProps<MentionItem>) => {
        const rect = props.clientRect?.();
        if (!popup || !rect) return;
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.bottom + 6}px`;
      };

      return {
        onStart: (props: SuggestionProps<MentionItem>) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });
          popup = document.createElement("div");
          popup.className = "fixed z-[200]";
          popup.appendChild(component.element);
          document.body.appendChild(popup);
          updatePopupPosition(props);
        },
        onUpdate(props: SuggestionProps<MentionItem>) {
          component?.updateProps(props);
          updatePopupPosition(props);
        },
        onKeyDown(props: SuggestionKeyDownProps) {
          if (props.event.key === "Escape") {
            return true;
          }
          return component?.ref?.onKeyDown(props) ?? false;
        },
        onExit() {
          popup?.remove();
          component?.destroy();
        },
      };
    },
  };
}

function createMentionSuggestionFromRef(
  referencesRef: MutableRefObject<CanvasAssetReference[]>,
) {
  return {
    char: "@",
    items: ({ query }: { query: string }) =>
      referencesRef.current
        .map(toMentionItem)
        .filter((item) => {
          const keyword = query.trim().toLowerCase();
          if (!keyword) return true;
          return (
            item.alias.toLowerCase().includes(keyword) ||
            item.description.toLowerCase().includes(keyword) ||
            item.kind.toLowerCase().includes(keyword)
          );
        })
        .slice(0, 12),
    render: createMentionSuggestion([]).render,
  };
}

function extractMentionTokens(editorJson: any, promptNodeId: string): CanvasMentionToken[] {
  const tokens: CanvasMentionToken[] = [];
  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "mention" && node.attrs) {
      tokens.push({
        id: `${promptNodeId}-${node.attrs.nodeId}`,
        alias: String(node.attrs.alias ?? node.attrs.label ?? ""),
        nodeId: String(node.attrs.nodeId ?? ""),
        kind: node.attrs.kind,
        use: node.attrs.use,
      });
    }
    if (Array.isArray(node.content)) node.content.forEach(visit);
  };
  visit(editorJson);
  return tokens.filter((token) => token.nodeId && token.alias);
}

function extractPlainTextFromEditorJson(editorJson: any): string {
  const lines: string[] = [];
  let currentLine = "";
  const appendText = (value: string) => {
    currentLine += value;
  };
  const flushLine = () => {
    lines.push(currentLine);
    currentLine = "";
  };
  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "text") {
      appendText(String(node.text ?? ""));
      return;
    }
    if (node.type === "mention") {
      const alias = String(node.attrs?.alias ?? node.attrs?.label ?? "");
      appendText(alias ? `@${alias}` : "");
      return;
    }
    const isBlock = node.type === "paragraph";
    if (Array.isArray(node.content)) node.content.forEach(visit);
    if (isBlock) flushLine();
  };
  visit(editorJson);
  if (currentLine || lines.length === 0) flushLine();
  return lines.join("\n").replace(/\n+$/g, "");
}

function textToHtml(text: string, tokens: CanvasMentionToken[]) {
  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  for (const token of tokens) {
    const aliasText = `@${token.alias}`;
    const mentionHtml = `<span data-type="mention" data-id="${token.nodeId}" data-label="${token.alias}" data-alias="${token.alias}" data-node-id="${token.nodeId}" data-kind="${token.kind}" data-use="${token.use}">${aliasText}</span>`;
    escaped = escaped.replaceAll(aliasText, mentionHtml);
  }
  return escaped
    .split(/\n/)
    .map((line) => `<p>${line || "<br>"}</p>`)
    .join("");
}

export function MentionPromptEditor({
  promptNodeId,
  text,
  mentionTokens,
  references,
  brokenNodeIds,
  onChange,
  onFocusReference,
}: {
  promptNodeId: string;
  text: string;
  mentionTokens: CanvasMentionToken[];
  references: CanvasAssetReference[];
  brokenNodeIds: Set<string>;
  onChange: (text: string, tokens: CanvasMentionToken[]) => void;
  onFocusReference?: (nodeId: string) => void;
}) {
  const referencesRef = useRef(references);
  const brokenNodeIdsRef = useRef(brokenNodeIds);
  const onChangeRef = useRef(onChange);
  const onFocusReferenceRef = useRef(onFocusReference);
  const promptNodeIdRef = useRef(promptNodeId);
  useEffect(() => {
    referencesRef.current = references;
    brokenNodeIdsRef.current = brokenNodeIds;
    onChangeRef.current = onChange;
    onFocusReferenceRef.current = onFocusReference;
    promptNodeIdRef.current = promptNodeId;
  }, [brokenNodeIds, onChange, onFocusReference, promptNodeId, references]);

  const mentionExtension = useMemo(
    () =>
      Mention.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            alias: {
              default: null,
              parseHTML: (element) => element.getAttribute("data-alias"),
              renderHTML: (attributes) =>
                attributes.alias ? { "data-alias": attributes.alias } : {},
            },
            nodeId: {
              default: null,
              parseHTML: (element) => element.getAttribute("data-node-id"),
              renderHTML: (attributes) =>
                attributes.nodeId ? { "data-node-id": attributes.nodeId } : {},
            },
            kind: {
              default: null,
              parseHTML: (element) => element.getAttribute("data-kind"),
              renderHTML: (attributes) =>
                attributes.kind ? { "data-kind": attributes.kind } : {},
            },
            use: {
              default: null,
              parseHTML: (element) => element.getAttribute("data-use"),
              renderHTML: (attributes) =>
                attributes.use ? { "data-use": attributes.use } : {},
            },
          };
        },
      }).configure({
        HTMLAttributes: {
          class: "canvas-mention-token",
        },
        suggestion: createMentionSuggestionFromRef(referencesRef),
        renderText({ node }) {
          return `@${node.attrs.alias ?? node.attrs.label}`;
        },
        renderHTML({ node }) {
          const broken = brokenNodeIdsRef.current.has(String(node.attrs.nodeId ?? node.attrs.id));
          return [
            "span",
            {
              "data-node-id": node.attrs.nodeId ?? node.attrs.id,
              "data-alias": node.attrs.alias ?? node.attrs.label,
              "data-kind": node.attrs.kind,
              "data-use": node.attrs.use,
              class: cn("canvas-mention-token", broken && "canvas-mention-token-broken"),
            },
            `@${node.attrs.alias ?? node.attrs.label}`,
          ];
        },
      }),
    [],
  );
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
      }),
      mentionExtension,
    ],
    content: textToHtml(text, mentionTokens),
    editorProps: {
      attributes: {
        class: "canvas-prompt-editor nodrag nowheel min-h-[96px] h-full outline-none",
        "data-canvas-editor": "true",
        role: "textbox",
      },
      handleClickOn(_view, _pos, node) {
        if (node.type.name !== "mention") return false;
        const nodeId = String(node.attrs.nodeId ?? node.attrs.id ?? "");
        if (nodeId) onFocusReferenceRef.current?.(nodeId);
        return true;
      },
      handleKeyDown(_view, event) {
        event.stopPropagation();
        return false;
      },
    },
    onUpdate({ editor }) {
      const editorJson = editor.getJSON();
      onChangeRef.current(
        extractPlainTextFromEditorJson(editorJson),
        extractMentionTokens(editorJson, promptNodeIdRef.current),
      );
    },
  }, [mentionExtension]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = extractPlainTextFromEditorJson(editor.getJSON());
    if (current === text) return;
    editor.commands.setContent(textToHtml(text, mentionTokens), { emitUpdate: false });
  }, [editor, mentionTokens, text]);

  return (
    <div
      className="h-full min-h-0 flex-1 overflow-y-auto rounded-xl border border-border-soft bg-surface-app/50 p-2 text-[13px] text-text shadow-inner focus-within:border-brand focus-within:ring-1 focus-within:ring-brand"
      data-canvas-editor="true"
      role="textbox"
      onKeyDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
