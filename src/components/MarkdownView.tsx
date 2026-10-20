import { type FC, type ComponentProps, useCallback, useMemo, createContext, useContext, useRef, useState } from 'react';
import ReactMarkdown, { type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { open } from '@tauri-apps/plugin-shell';
import { Copy, Check } from 'lucide-react';
import styles from './MarkdownView.module.scss';
import { soundEngine, playCheckboxCheckWithFile } from '../utils/audio';
import { preserveBlankLines, toggleTaskLine } from '../utils/markdown';
import { copyRich, copyPlain } from '../utils/clipboard';

// Minimal shape of the MDAST nodes this plugin touches
interface RemarkNode {
  type?: string;
  checked?: boolean | null;
  position?: { start: { line: number; offset: number }; end: { offset: number } };
  data?: { hName?: string; hProperties?: Record<string, unknown> };
  children?: RemarkNode[];
  value?: string;
}

// ─── Remark plugin: embed 0-indexed source line on each task list item ──────────
function remarkTaskLineIndex() {
  return (tree: RemarkNode) => {
    function walk(node: RemarkNode) {
      if (node.type === 'listItem' && node.checked !== null && node.checked !== undefined && node.position) {
        const lineIndex = node.position.start.line - 1;
        node.data = node.data ?? {};
        node.data.hProperties = { ...(node.data.hProperties ?? {}), 'data-src-line': lineIndex };
      }
      if (Array.isArray(node.children)) node.children.forEach(walk);
    }
    walk(tree);
  };
}

// ─── Remark plugin: [c] marks ONE line as copyable ──────────────────────────────
// remark-breaks turns each newline into a `break` node inside the same paragraph, so a paragraph
// is split on `break` nodes and only the line holding the marker is wrapped in a <span> carrying
// the data-* props. Only `text` nodes are inspected, so [c] inside `code` is left alone.
const MARKER = /\[c\]/;
const MARKER_ALL = /[ \t]*\[c\]/g;

function hasMarker(nodes: RemarkNode[]): boolean {
  return nodes.some(n => {
    if (n.type === 'inlineCode') return false;
    if (n.type === 'text') return MARKER.test(n.value ?? '');
    return n.children ? hasMarker(n.children) : false;
  });
}

function stripMarker(nodes: RemarkNode[]): void {
  for (const n of nodes) {
    if (n.type === 'inlineCode') continue;
    if (n.type === 'text' && n.value !== undefined) n.value = n.value.replace(MARKER_ALL, '');
    else if (n.children) stripMarker(n.children);
  }
  const first = nodes[0];
  if (first?.type === 'text' && first.value !== undefined) first.value = first.value.trimStart();
}

const cleanRawLine = (line: string) => line.replace(MARKER_ALL, '').trim();

function remarkCopyMarker(source: string) {
  return () => (tree: RemarkNode) => {
    const wrap = (segment: RemarkNode[], raw: string): RemarkNode => ({
      type: 'copyLine',
      data: { hName: 'span', hProperties: { 'data-copy-line': 'true', 'data-copy-source': raw } },
      children: segment,
    });

    function splitLines(node: RemarkNode) {
      if (!node.children || !node.position) return;
      const rawLines = source.slice(node.position.start.offset, node.position.end.offset).split('\n');
      const segments: RemarkNode[][] = [[]];
      const breaks: RemarkNode[] = [];
      for (const child of node.children) {
        if (child.type === 'break') {
          breaks.push(child);
          segments.push([]);
        } else {
          segments[segments.length - 1].push(child);
        }
      }
      if (!segments.some(hasMarker)) return;
      // Lines and segments line up unless an inline node itself spans a newline
      const aligned = rawLines.length === segments.length;
      const next: RemarkNode[] = [];
      segments.forEach((segment, i) => {
        if (hasMarker(segment)) {
          const raw = cleanRawLine(aligned ? rawLines[i] : rawLines.join(' '));
          stripMarker(segment);
          next.push(wrap(segment, raw));
        } else {
          next.push(...segment);
        }
        if (i < breaks.length) next.push(breaks[i]);
      });
      node.children = next;
    }

    function walk(node: RemarkNode) {
      if (node.type === 'paragraph' || node.type === 'heading') {
        splitLines(node);
        return;
      }
      if (Array.isArray(node.children)) node.children.forEach(walk);
    }
    walk(tree);
  };
}

// ─── Contexts ────────────────────────────────────────────────────────────────────
const LineIndexContext = createContext<number>(-1);
type ToggleFn = (lineIndex: number) => void;
const ToggleContext = createContext<ToggleFn>(() => {});

// ─── CopyLine: a [c]-marked line with its own copy button ───────────────────────
type CopyLineProps = ComponentProps<'span'> & ExtraProps & { 'data-copy-line'?: string; 'data-copy-source'?: string };

const CopyLine: FC<CopyLineProps> = (allProps) => {
  const { node, 'data-copy-line': copyLine, 'data-copy-source': copySource, children, ...props } = allProps;
  void node;
  const contentRef = useRef<HTMLSpanElement>(null);
  const [copied, setCopied] = useState(false);

  if (copyLine !== 'true') return <span {...props}>{children}</span>;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey) {
      void copyPlain(copySource ?? '');
    } else {
      const el = contentRef.current;
      void copyRich(el?.innerHTML ?? '', el?.innerText ?? el?.textContent ?? copySource ?? '');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span {...props} className={styles.copyLine}>
      <span ref={contentRef}>{children}</span>
      <button
        className={styles.copyRowBtn}
        onClick={handleClick}
        // Keeps a Shift+click from extending the text selection
        onMouseDown={e => e.preventDefault()}
        aria-label="copy row"
        title="Copy line (Shift+click for markdown)"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </span>
  );
};

// ─── Stable markdown component overrides ────────────────────────────────────────
type MdProps<T extends keyof React.JSX.IntrinsicElements> = ComponentProps<T> & ExtraProps;

const TaskListItem: FC<MdProps<'li'> & { 'data-src-line'?: string | number }> = ({ 'data-src-line': srcLine, children, ...allProps }) => {
  const { node, ...props } = allProps;
  void node; // react-markdown's AST node must not reach the DOM
  const lineIndex = srcLine !== undefined ? Number(srcLine) : -1;
  return (
    <LineIndexContext.Provider value={lineIndex}>
      <li {...props}>{children}</li>
    </LineIndexContext.Provider>
  );
};

const TaskCheckbox: FC<MdProps<'input'>> = (allProps) => {
  const { node, ...props } = allProps;
  void node;
  const lineIndex = useContext(LineIndexContext);
  const toggle = useContext(ToggleContext);
  if (props.type !== 'checkbox') return <input {...props} />;
  return (
    <input
      type="checkbox"
      checked={!!props.checked}
      onChange={() => lineIndex >= 0 && toggle(lineIndex)}
      className={styles.checkbox}
    />
  );
};

const ExternalLink: FC<MdProps<'a'>> = (allProps) => {
  const { href, children, node, ...props } = allProps;
  void node;
  return (
    <a
      {...props}
      href={href}
      onClick={(e) => { e.preventDefault(); if (href) open(href); }}
    >
      {children}
    </a>
  );
};

const ScrollTable: FC<MdProps<'table'>> = (allProps) => {
  const { node, ...props } = allProps;
  void node;
  return (
    <div className={styles.tableWrap}>
      <table {...props} />
    </div>
  );
};

// ─── CodeBlock: wraps <pre> with a copy button ──────────────────────────────────
const CodeBlock: FC<MdProps<'pre'>> = (allProps) => {
  const { node, children, ...props } = allProps;
  void node;
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const code = preRef.current?.querySelector('code')?.textContent ?? '';
    void copyPlain(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <pre {...props} ref={preRef} className={`${props.className ?? ''} ${styles.codeBlock}`}>
      <button
        className={styles.codeBlockCopyBtn}
        onClick={handleCopy}
        onMouseDown={e => e.preventDefault()}
        aria-label="copy code"
        title="Copy code"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
      {children}
    </pre>
  );
};

const MARKDOWN_COMPONENTS = {
  li: TaskListItem,
  input: TaskCheckbox,
  a: ExternalLink,
  table: ScrollTable,
  span: CopyLine,
  pre: CodeBlock,
};

const REMARK_PLUGINS_BASE = [remarkGfm, remarkBreaks, remarkTaskLineIndex];

export interface MarkdownViewProps {
  source: string;
  onChange?: (next: string) => void;
  className?: string;
}

export const MarkdownView: FC<MarkdownViewProps> = ({ source, onChange, className }) => {
  const { rendered, lineMap } = useMemo(() => preserveBlankLines(source), [source]);

  const remarkPlugins = useMemo(
    () => [...REMARK_PLUGINS_BASE, remarkCopyMarker(rendered)],
    [rendered]
  );

  const handleToggle = useCallback((renderedLineIndex: number) => {
    if (!onChange) return;
    const result = toggleTaskLine(source, lineMap[renderedLineIndex] ?? renderedLineIndex);
    if (!result) return;
    if (result.checked) playCheckboxCheckWithFile();
    else soundEngine.playCheckboxUncheck();
    onChange(result.source);
  }, [source, lineMap, onChange]);

  return (
    <ToggleContext.Provider value={handleToggle}>
      <div className={`${styles.markdown} ${className ?? ''}`}>
        <ReactMarkdown remarkPlugins={remarkPlugins} components={MARKDOWN_COMPONENTS}>
          {rendered}
        </ReactMarkdown>
      </div>
    </ToggleContext.Provider>
  );
};
