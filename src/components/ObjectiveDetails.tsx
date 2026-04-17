import { type FC, useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import styles from './ObjectiveDetails.module.scss';
import { Edit3, Check, X, ClipboardList, Heading1, Heading2, Heading3, List, ListChecks, Strikethrough, Table } from 'lucide-react';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine } from '../utils/audio';

// ─── Remark plugin: embed 0-indexed source line on each task list item ──────────
// This runs on the MDAST after remark-gfm has set node.checked,
// and adds data-src-line to hProperties so react-markdown passes it as a prop.
function remarkTaskLineIndex() {
  return (tree: any) => {
    function walk(node: any) {
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
// ToggleContext: provides handleCheckboxToggle to TaskCheckbox without prop drilling
type ToggleFn = (lineIndex: number) => void;
const ToggleContext = createContext<ToggleFn>(() => {});

// ─── Stable markdown component overrides (defined outside, never recreated) ─────
const TaskListItem: FC<any> = ({ node, 'data-src-line': srcLine, children, ...props }) => {
  const lineIndex = srcLine !== undefined ? Number(srcLine) : -1;
  return (
    <LineIndexContext.Provider value={lineIndex}>
      <li {...props}>{children}</li>
    </LineIndexContext.Provider>
  );
};

const TaskCheckbox: FC<any> = ({ node, ...props }) => {
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

// Single stable components object — ReactMarkdown won't remount on every render
const MARKDOWN_COMPONENTS = { li: TaskListItem, input: TaskCheckbox };

// ─── Main component ───────────────────────────────────────────────────────────────
interface Props {
  onClose: () => void;
}

export const ObjectiveDetails: FC<Props> = ({ onClose }) => {
  const { activeObjectiveId, objectivePool, updateObjectiveDetails } = useFocus();
  const activeObjective = objectivePool.find(o => o.id === activeObjectiveId) ?? null;

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setIsEditing(false);
  }, [activeObjectiveId]);

  // Enter in preview mode → enter edit mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditing) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        soundEngine.playEditStart();
        setIsEditing(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing]);

  useEffect(() => {
    if (isEditing) {
      setEditText(activeObjective?.details ?? '');
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [isEditing, activeObjective?.details]);

  const handleEdit = () => {
    soundEngine.playEditStart();
    setIsEditing(true);
  };

  const handleSave = useCallback(() => {
    if (!activeObjective) return;
    soundEngine.playClick();
    updateObjectiveDetails(activeObjective.id, editText.trim() || null);
    setIsEditing(false);
  }, [activeObjective, editText, updateObjectiveDetails]);

  const handleCancel = () => {
    soundEngine.playClick();
    setIsEditing(false);
  };

  const wrapSelection = useCallback((before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    soundEngine.playClick();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = editText.slice(start, end) || 'text';
    const newText = editText.slice(0, start) + before + selected + after + editText.slice(end);
    setEditText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  }, [editText]);

  const insertTemplate = useCallback((template: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    soundEngine.playClick();
    const pos = textarea.selectionStart;
    const value = editText;
    // If cursor is not at the start of a line, prepend a newline
    const charBefore = pos > 0 ? value[pos - 1] : '\n';
    const prefix = charBefore !== '\n' ? '\n' : '';
    const insertion = prefix + template;
    const newText = value.slice(0, pos) + insertion + value.slice(pos);
    setEditText(newText);
    const newCursor = pos + insertion.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursor, newCursor);
    }, 0);
  }, [editText]);

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (e.shiftKey) {
        handleCancel(); // Shift+Escape → discard changes
      } else {
        handleSave();   // Escape → save
      }
      return;
    }
    if (e.key === 'd' && e.ctrlKey) {
      e.preventDefault();
      soundEngine.playClick();
      const textarea = e.currentTarget;
      const pos = textarea.selectionStart;
      const value = editText;
      const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
      const lineEndIdx = value.indexOf('\n', pos);
      const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
      const currentLine = value.slice(lineStart, lineEnd);
      const newText = value.slice(0, lineEnd) + '\n' + currentLine + value.slice(lineEnd);
      setEditText(newText);
      const newPos = lineEnd + 1 + (pos - lineStart);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      }, 0);
    }
  };

  const handleCheckboxToggle = useCallback((lineIndex: number) => {
    if (!activeObjective?.details) return;
    const lines = activeObjective.details.split('\n');
    const line = lines[lineIndex];
    if (/\[ \]/.test(line)) {
      lines[lineIndex] = line.replace('[ ]', '[x]');
    } else if (/\[x\]/i.test(line)) {
      lines[lineIndex] = line.replace(/\[x\]/i, '[ ]');
    }
    soundEngine.playClick();
    updateObjectiveDetails(activeObjective.id, lines.join('\n'));
  }, [activeObjective, updateObjectiveDetails]);

  const details = activeObjective?.details ?? null;

  // Markdown collapses multiple blank lines into one paragraph break.
  // Replace each extra blank line with a zero-width-space paragraph so the
  // visual spacing the user typed in the textarea is preserved in preview.
  const renderedDetails = details
    ? details.replace(/\n{3,}/g, m => '\n\n' + '\u200b\n\n'.repeat(m.length - 2))
    : null;

  return (
    <aside className={styles.sidebar}>
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <ClipboardList size={14} />
            <h4>OBJECTIVE_DETAILS</h4>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close (Esc)">
            <X size={14} />
          </button>
        </div>

        <div className={styles.body}>
          {isEditing ? (
            <div className={styles.editContainer}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={handleTextareaKeyDown}
                placeholder={'Write notes, tasks, links...\n\nUse - [ ] for checkboxes\nUse **bold** or *italic*\nUse [text](url) for links'}
                spellCheck={false}
              />
              <div className={styles.toolbar}>
                <div className={styles.toolbarGroup}>
                  <button className={styles.toolBtn} onClick={() => insertTemplate('# ')} title="Heading 1">
                    <Heading1 size={13} />
                  </button>
                  <button className={styles.toolBtn} onClick={() => insertTemplate('## ')} title="Heading 2">
                    <Heading2 size={13} />
                  </button>
                  <button className={styles.toolBtn} onClick={() => insertTemplate('### ')} title="Heading 3">
                    <Heading3 size={13} />
                  </button>
                </div>
                <div className={styles.toolbarDivider} />
                <div className={styles.toolbarGroup}>
                  <button className={styles.toolBtn} onClick={() => insertTemplate('- Item 1\n- Item 2\n- Item 3')} title="Bullet list">
                    <List size={13} />
                  </button>
                  <button className={styles.toolBtn} onClick={() => insertTemplate('- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3')} title="Task list">
                    <ListChecks size={13} />
                  </button>
                  <button className={styles.toolBtn} onClick={() => wrapSelection('~~', '~~')} title="Strikethrough">
                    <Strikethrough size={13} />
                  </button>
                  <button className={styles.toolBtn} onClick={() => insertTemplate('| Col 1       | Col 2       | Col 3       |\n| :---        |    :---:    |        ---: |\n| Cell        | Cell        | Cell        |\n| Cell        | Cell        | Cell        |')} title="Table">
                    <Table size={13} />
                  </button>
                </div>
                <span className={styles.toolbarHint}>Esc saves · Shift+Esc reverts · Ctrl+D dupes line</span>
              </div>
              <div className={styles.editActions}>
                <button className={styles.saveBtn} onClick={handleSave}>
                  <Check size={12} /> SAVE
                </button>
                <button className={styles.cancelBtn} onClick={handleCancel}>
                  <X size={12} /> CANCEL
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.previewContainer}>
              {renderedDetails ? (
                <ToggleContext.Provider value={handleCheckboxToggle}>
                  <div className={styles.markdown}>
                    <ReactMarkdown
                      remarkPlugins={REMARK_PLUGINS}
                      components={MARKDOWN_COMPONENTS}
                    >
                      {renderedDetails}
                    </ReactMarkdown>
                  </div>
                </ToggleContext.Provider>
              ) : (
                <div className={styles.empty}>No details. Click EDIT to add details.</div>
              )}
              <button className={styles.editBtn} onClick={handleEdit}>
                <Edit3 size={12} /> EDIT
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
