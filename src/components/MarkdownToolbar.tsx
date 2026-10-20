import type { FC } from 'react';
import { Heading1, Heading2, Heading3, Bold, Italic, Strikethrough, List, ListChecks, Link2, Table } from 'lucide-react';
import styles from './MarkdownToolbar.module.scss';
import type { MarkdownEditor } from '../hooks/useMarkdownEditor';

export const TABLE_TEMPLATE =
  '| Col 1       | Col 2       | Col 3       |\n' +
  '| :---        |    :---:    |        ---: |\n' +
  '| Cell        | Cell        | Cell        |\n' +
  '| Cell        | Cell        | Cell        |';

interface MarkdownToolbarProps {
  editor: Pick<MarkdownEditor, 'wrapSelection' | 'insertTemplate' | 'insertLink'>;
  compact?: boolean; // smaller icons and padding (canvas notes)
}

export const MarkdownToolbar: FC<MarkdownToolbarProps> = ({ editor, compact = false }) => {
  const { wrapSelection, insertTemplate, insertLink } = editor;
  const size = compact ? 11 : 13;
  return (
    <div className={`${styles.toolbar} ${compact ? styles.compact : ''}`}>
      <div className={styles.toolbarGroup}>
        <button className={styles.toolBtn} onClick={() => insertTemplate('# ')} title="Heading 1"><Heading1 size={size} /></button>
        <button className={styles.toolBtn} onClick={() => insertTemplate('## ')} title="Heading 2"><Heading2 size={size} /></button>
        <button className={styles.toolBtn} onClick={() => insertTemplate('### ')} title="Heading 3"><Heading3 size={size} /></button>
      </div>
      <div className={styles.toolbarDivider} />
      <div className={styles.toolbarGroup}>
        <button className={styles.toolBtn} onClick={() => wrapSelection('**', '**')} title="Bold (Ctrl+B)"><Bold size={size} /></button>
        <button className={styles.toolBtn} onClick={() => wrapSelection('_', '_')} title="Italic (Ctrl+I)"><Italic size={size} /></button>
        <button className={styles.toolBtn} onClick={() => wrapSelection('~~', '~~')} title="Strikethrough (Ctrl+S)"><Strikethrough size={size} /></button>
      </div>
      <div className={styles.toolbarDivider} />
      <div className={styles.toolbarGroup}>
        <button className={styles.toolBtn} onClick={() => insertTemplate('- Item 1\n- Item 2\n- Item 3')} title="Bullet list"><List size={size} /></button>
        <button className={styles.toolBtn} onClick={() => insertTemplate('- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3')} title="Task list"><ListChecks size={size} /></button>
        <button className={styles.toolBtn} onClick={insertLink} title="Insert link"><Link2 size={size} /></button>
        <button className={styles.toolBtn} onClick={() => insertTemplate(TABLE_TEMPLATE)} title="Table"><Table size={size} /></button>
      </div>
    </div>
  );
};
