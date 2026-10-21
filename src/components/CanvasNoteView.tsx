import { type FC, type RefObject, useCallback, useRef, useEffect, useState } from 'react';
import { Trash2, Copy, CopyPlus, Palette } from 'lucide-react';
import styles from './CanvasNoteView.module.scss';
import { soundEngine } from '../utils/audio';
import { copyRich } from '../utils/clipboard';
import { usePanelDrag } from '../hooks/usePanelDrag';
import { useMarkdownEditor, type MarkdownEditor } from '../hooks/useMarkdownEditor';
import type { MinSize } from '../utils/canvas';
import { MarkdownView } from './MarkdownView';
import { MarkdownToolbar } from './MarkdownToolbar';
import { ConfirmDialog } from './ConfirmDialog';
import { ContextMenu } from './ContextMenu';
import type { BucketGeometry, CanvasNote } from '../types';

// Exported for BucketsPage (placement/clamping); a one-off constant, not worth its own module
// eslint-disable-next-line react-refresh/only-export-components
export const NOTE_MIN_SIZE: MinSize = { w: 160, h: 100 };

// Above every note (BucketsPage gives notes NOTE_Z_BASE + stacking order)
const DRAGGING_Z_INDEX = 200000;

// Presses on these act on the control itself, never move the note
const INTERACTIVE = 'button, input, a, textarea';

export interface CanvasNoteViewProps {
  note: CanvasNote;
  zoom: number;
  zIndex: number;
  isEditing: boolean;
  onStartEdit: (id: number) => void;
  onEndEdit: (id: number) => void;
  onContentChange: (id: number, content: string) => void;
  onColorChange: (id: number, color: string) => void;
  onGeometryChange: (id: number, geometry: BucketGeometry) => void;
  onBringToFront: (id: number) => void;
  onDuplicate: (id: number) => void;
  onDelete: (id: number) => void;
}

interface NoteEditorProps {
  initialText: string;
  containerRef: RefObject<HTMLDivElement | null>;
  onSave: (text: string) => void;
  onCancel: () => void;
}

// Mounted only while editing, so every edit starts from the note's current text
const NoteEditor: FC<NoteEditorProps> = ({ initialText, containerRef, onSave, onCancel }) => {
  // Annotated: the initializer refers to `editor` (TS7022 otherwise)
  const editor: MarkdownEditor = useMarkdownEditor({ initialText, onSave: () => { onSave(editor.text); }, onCancel });
  const { text, textareaRef } = editor;

  // Clicking anywhere outside the note saves (same as Esc)
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      onSave(text);
    };
    // Capture phase + pointerdown: the viewport preventDefaults pointerdown (no mousedown follows) and panel drags stop propagation
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [containerRef, onSave, text]);

  return (
    <div className={styles.editor} data-canvas-scroll>
      <textarea
        ref={textareaRef}
        className={styles.textarea}
        value={text}
        onChange={e => editor.setText(e.target.value)}
        onKeyDown={editor.handleKeyDown}
        onPaste={editor.handlePaste}
        placeholder={'Markdown...\nEsc saves · Shift+Esc cancels'}
        spellCheck={false}
        autoFocus
      />
      <MarkdownToolbar editor={editor} compact />
    </div>
  );
};

export const CanvasNoteView: FC<CanvasNoteViewProps> = ({
  note, zoom, zIndex, isEditing,
  onStartEdit, onEndEdit, onContentChange, onColorChange, onGeometryChange, onBringToFront, onDuplicate, onDelete,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  const { geom, isDragging, beginPointerDrag, handlePointerMove, handlePointerUp } = usePanelDrag({
    geometry: { x: note.x, y: note.y, w: note.w, h: note.h },
    zoom,
    minSize: NOTE_MIN_SIZE,
    onDragEnd: (final, changed) => {
      // The last note moved or resized stays in front of the other notes
      onBringToFront(note.id);
      if (changed) onGeometryChange(note.id, final);
    },
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isEditing) return;
    if ((e.target as Element).closest(INTERACTIVE)) return;
    beginPointerDrag(e, 'move');
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isEditing) return;
    if ((e.target as Element).closest(INTERACTIVE)) return;
    soundEngine.playEditStart();
    onStartEdit(note.id);
  };

  const handleSave = (text: string) => {
    const content = text.trim();
    if (content !== note.content) onContentChange(note.id, content);
    soundEngine.playClick();
    onEndEdit(note.id);
  };

  const handleCancel = () => {
    soundEngine.playClick();
    onEndEdit(note.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isEditing) return; // keep the native menu (paste, etc.) in the editor
    e.preventDefault();
    soundEngine.playClick();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const deleteNow = () => {
    soundEngine.playClick();
    setConfirmingDelete(false);
    onDelete(note.id);
  };

  // A note with text asks first; an empty one just goes
  const handleDelete = () => {
    if (note.content.trim()) setConfirmingDelete(true);
    else deleteNow();
  };

  return (
    <div
      ref={rootRef}
      className={`${styles.note} ${isDragging ? styles.dragging : ''} ${isEditing ? styles.editing : ''}`}
      data-note-id={note.id}
      data-details-barrier
      style={{
        left: geom.x,
        top: geom.y,
        width: geom.w,
        height: geom.h,
        zIndex: isDragging ? DRAGGING_Z_INDEX : zIndex,
        // Opaque so notes don't show the panels underneath
        background: `color-mix(in srgb, ${note.color} 18%, var(--bg-dark))`,
        borderColor: note.color,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      {isEditing ? (
        <NoteEditor initialText={note.content} containerRef={rootRef} onSave={handleSave} onCancel={handleCancel} />
      ) : (
        <>
          <input
            ref={colorInputRef}
            type="color"
            className={styles.colorInput}
            value={note.color}
            onChange={e => onColorChange(note.id, e.target.value)}
            aria-label="Note color"
            tabIndex={-1}
          />
          <div ref={bodyRef} className={styles.body} data-canvas-scroll>
            {note.content ? (
              <MarkdownView source={note.content} onChange={next => onContentChange(note.id, next)} className={styles.markdown} />
            ) : (
              <div className={styles.empty}>Double-click to edit</div>
            )}
          </div>
        </>
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
          items={[
            // The rendered note: rich text for editors that take it, plain text elsewhere
            { label: 'Copy', icon: <Copy size={12} />, onSelect: () => { void copyRich(bodyRef.current?.innerHTML ?? '', bodyRef.current?.innerText ?? note.content); } },
            { label: 'Duplicate', icon: <CopyPlus size={12} />, onSelect: () => onDuplicate(note.id) },
            { label: 'Change color', icon: <Palette size={12} />, onSelect: () => colorInputRef.current?.click() },
            { label: 'Delete', icon: <Trash2 size={12} />, onSelect: handleDelete },
          ]}
        />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="DELETE_NOTE"
          message="This note and its text will be permanently deleted."
          confirmLabel="DELETE"
          onConfirm={deleteNow}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      <div
        className={styles.resizeHandle}
        onPointerDown={e => beginPointerDrag(e, 'resize')}
        title="Resize"
      />
    </div>
  );
};
