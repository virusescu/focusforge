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
  data?: { hProperties?: Record<string, unknown> };
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

// ─── Remark plugin: strip [c] markers and annotate nodes with copy data ─────────
// Only inspects `text` nodes (not `inlineCode`), so [c] inside backticks is preserved.
function remarkCopyMarker(source: string) {
  return () => (tree: RemarkNode) => {
    function hasMarker(node: RemarkNode): boolean {
      if (!Array.isArray(node.children)) return false;
      return node.children.some(child => {
        if (child.type === 'inlineCode') return false;
        if (child.type === 'text' && child.value !== undefined) return /\[c\]/.test(child.value);
        return hasMarker(child);
      });
    }

    function stripMarker(node: RemarkNode): void {
      if (!Array.isArray(node.children)) return;
      for (const child of node.children) {
        if (child.type === 'text' && child.value !== undefined) {
          child.value = child.value.replace(/\s*\[c\]\s*/g, ' ').trim();
        } else {
          stripMarker(child);
        }
      }
    }

    function walk(node: RemarkNode) {
      if (
        (node.type === 'paragraph' || node.type === 'heading' || node.type === 'listItem') &&
        node.position &&
        hasMarker(node)
      ) {
        const rawSource = source
          .slice(node.position.start.offset, node.position.end.offset)
          .replace(/\[c\]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        stripMarker(node);
        node.data = node.data ?? {};
        node.data.hProperties = {
          ...(node.data.hProperties ?? {}),
          'data-copy-line': 'true',
          'data-copy-source': rawSource,
        };
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

// ─── CopyRowButton ───────────────────────────────────────────────────────────────
interface CopyRowButtonProps {
  copySource: string;
  contentRef: React.RefObject<HTMLSpanElement | null>;
}

const CopyRowButton: FC<CopyRowButtonProps> = ({ copySource, contentRef }) => {
  const [copied, setCopied] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = contentRef.current;
    if (e.shiftKey) {
      copyPlain(copySource);
    } else {
      const html = el?.innerHTML ?? '';
      const plain = el?.innerText ?? copySource;
      copyRich(html, plain);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      className={styles.copyRowBtn}
      onClick={handleClick}
      aria-label="copy row"
      title="Copy (Shift+click for raw markdown)"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
};

// ─── Stable markdown component overrides ────────────────────────────────────────
type MdProps<T extends keyof React.JSX.IntrinsicElements> = ComponentProps<T> & ExtraProps;

const TaskListItem: FC<MdProps<'li'> & { 'data-src-line'?: string | number; 'data-copy-line'?: string; 'data-copy-source'?: string }> = (allProps) => {
  const { node, 'data-src-line': srcLine, 'data-copy-line': copyLine, 'data-copy-source': copySource, children, ...props } = allProps;
  void node;
  const lineIndex = srcLine !== undefined ? Number(srcLine) : -1;
  const contentRef = useRef<HTMLSpanElement>(null);

  if (copyLine === 'true' && copySource !== undefined) {
    return (
      <LineIndexContext.Provider value={lineIndex}>
        <li {...props}>
          <span ref={contentRef}>{children}</span>
          <CopyRowButton copySource={copySource} contentRef={contentRef} />
        </li>
      </LineIndexContext.Provider>
    );
  }

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

// CopyParagraph: wraps paragraph/heading nodes that have data-copy-line set
type CopyBlockProps = MdProps<'p'> & { 'data-copy-line'?: string; 'data-copy-source'?: string };

const makeCopyBlock = (Tag: keyof React.JSX.IntrinsicElements): FC<CopyBlockProps> => {
  const CopyBlock: FC<CopyBlockProps> = (allProps) => {
    const { node, 'data-copy-line': copyLine, 'data-copy-source': copySource, children, ...props } = allProps;
    void node;
    const contentRef = useRef<HTMLSpanElement>(null);

    if (copyLine === 'true' && copySource !== undefined) {
      return (
        <Tag {...props} className={`${(props as { className?: string }).className ?? ''} ${styles.copyRow}`}>
          <span ref={contentRef}>{children}</span>
          <CopyRowButton copySource={copySource} contentRef={contentRef} />
        </Tag>
      );
    }
    return <Tag {...props}>{children}</Tag>;
  };
  CopyBlock.displayName = `CopyBlock(${String(Tag)})`;
  return CopyBlock;
};

const CopyParagraph = makeCopyBlock('p');
const CopyH1 = makeCopyBlock('h1');
const CopyH2 = makeCopyBlock('h2');
const CopyH3 = makeCopyBlock('h3');
const CopyH4 = makeCopyBlock('h4');
const CopyH5 = makeCopyBlock('h5');
const CopyH6 = makeCopyBlock('h6');

const MARKDOWN_COMPONENTS = {
  li: TaskListItem,
  input: TaskCheckbox,
  a: ExternalLink,
  table: ScrollTable,
  p: CopyParagraph,
  h1: CopyH1,
  h2: CopyH2,
  h3: CopyH3,
  h4: CopyH4,
  h5: CopyH5,
  h6: CopyH6,
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
