import { type FC, type ComponentProps, useCallback, useMemo, createContext, useContext } from 'react';
import ReactMarkdown, { type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { open } from '@tauri-apps/plugin-shell';
import styles from './MarkdownView.module.scss';
import { soundEngine, playCheckboxCheckWithFile } from '../utils/audio';
import { preserveBlankLines, toggleTaskLine } from '../utils/markdown';

// Minimal shape of the MDAST nodes this plugin touches
interface RemarkNode {
  type?: string;
  checked?: boolean | null;
  position?: { start: { line: number } };
  data?: { hProperties?: Record<string, unknown> };
  children?: RemarkNode[];
}

// ─── Remark plugin: embed 0-indexed source line on each task list item ──────────
// This runs on the MDAST after remark-gfm has set node.checked,
// and adds data-src-line to hProperties so react-markdown passes it as a prop.
function remarkTaskLineIndex() {
  return (tree: RemarkNode) => {
    function walk(node: RemarkNode) {
      if (node.type === 'listItem' && node.checked !== null && node.checked !== undefined && node.position) {
        const lineIndex = node.position.start.line - 1; // remark is 1-indexed
        node.data = node.data ?? {};
        node.data.hProperties = { ...(node.data.hProperties ?? {}), 'data-src-line': lineIndex };
      }
      if (Array.isArray(node.children)) node.children.forEach(walk);
    }
    walk(tree);
  };
}

// Stable remark plugin list — defined outside component so reference never changes
const REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkTaskLineIndex];

// ─── Contexts ────────────────────────────────────────────────────────────────────
// LineIndexContext: li component sets this for its children to read
const LineIndexContext = createContext<number>(-1);
// ToggleContext: provides the checkbox toggle to TaskCheckbox without prop drilling
type ToggleFn = (lineIndex: number) => void;
const ToggleContext = createContext<ToggleFn>(() => {});

// ─── Stable markdown component overrides (defined outside, never recreated) ─────
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

// Wide tables scroll sideways inside their own box instead of stretching the container
const ScrollTable: FC<MdProps<'table'>> = (allProps) => {
  const { node, ...props } = allProps;
  void node;
  return (
    <div className={styles.tableWrap}>
      <table {...props} />
    </div>
  );
};

// Single stable components object — ReactMarkdown won't remount on every render
const MARKDOWN_COMPONENTS = { li: TaskListItem, input: TaskCheckbox, a: ExternalLink, table: ScrollTable };

export interface MarkdownViewProps {
  source: string;
  // Called with the new source when a task checkbox is toggled; omit for read-only
  onChange?: (next: string) => void;
  className?: string;
}

export const MarkdownView: FC<MarkdownViewProps> = ({ source, onChange, className }) => {
  const { rendered, lineMap } = useMemo(() => preserveBlankLines(source), [source]);

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
        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
          {rendered}
        </ReactMarkdown>
      </div>
    </ToggleContext.Provider>
  );
};
