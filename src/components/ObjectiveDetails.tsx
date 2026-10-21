import { type FC, useState, useEffect, useRef, useCallback } from 'react';
import styles from './ObjectiveDetails.module.scss';
import { Edit3, Check, X } from 'lucide-react';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine } from '../utils/audio';
import { useMarkdownEditor } from '../hooks/useMarkdownEditor';
import { BucketTag } from './BucketTag';
import { MarkdownView } from './MarkdownView';
import { MarkdownToolbar } from './MarkdownToolbar';

interface Props {
  onClose: () => void;
  // Pressing elsewhere closes the panel (the HUD sidebar); the canvas drawer stays open until closed explicitly
  closeOnOutsidePress?: boolean;
}

export const ObjectiveDetails: FC<Props> = ({ onClose, closeOnOutsidePress = true }) => {
  const { viewedObjectiveId, objectivePool, buckets, updateObjectiveDetails } = useFocus();
  const activeObjective = objectivePool.find(o => o.id === viewedObjectiveId) ?? null;
  const activeBucket = activeObjective ? buckets.find(b => b.id === activeObjective.bucket_id) : undefined;

  const [isEditing, setIsEditing] = useState(false);
  const asideRef = useRef<HTMLElement>(null);

  const handleSave = () => {
    if (!activeObjective) return;
    soundEngine.playClick();
    updateObjectiveDetails(activeObjective.id, editor.text.trim() || null);
    setIsEditing(false);
  };

  const handleCancel = () => {
    soundEngine.playClick();
    setIsEditing(false);
  };

  const editor = useMarkdownEditor({ onSave: handleSave, onCancel: handleCancel });
  const { setText, textareaRef } = editor;

  useEffect(() => {
    if (!closeOnOutsidePress) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (asideRef.current?.contains(e.target as Node)) return;
      const target = e.target as Element;
      if (target.closest('[data-details-barrier], button, input, select, a, textarea, [role="button"]')) return;
      onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose, closeOnOutsidePress]);

  useEffect(() => {
    if (!viewedObjectiveId) {
      onClose();
    }
  }, [viewedObjectiveId, onClose]);

  useEffect(() => {
    setIsEditing(false);
  }, [viewedObjectiveId]);

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
      setText(activeObjective?.details ?? '');
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [isEditing, activeObjective?.details, setText, textareaRef]);

  const handleEdit = () => {
    soundEngine.playEditStart();
    setIsEditing(true);
  };

  const handleDetailsChange = useCallback((next: string) => {
    if (activeObjective) updateObjectiveDetails(activeObjective.id, next);
  }, [activeObjective, updateObjectiveDetails]);

  const details = activeObjective?.details ?? null;

  return (
    <aside className={styles.sidebar} ref={asideRef as any}>
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <h4>{activeObjective?.text ?? 'OBJECTIVE_DETAILS'}</h4>
            {activeBucket && <BucketTag bucket={activeBucket} className={styles.bucketTag} />}
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close (Esc)">
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          {isEditing ? (
            <div className={styles.editContainer}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                value={editor.text}
                onChange={e => setText(e.target.value)}
                onKeyDown={editor.handleKeyDown}
                onPaste={editor.handlePaste}
                placeholder={'Write notes, tasks, links...\n\nUse - [ ] for checkboxes\nUse **bold** or *italic*\nUse [text](url) for links'}
                spellCheck={false}
              />
              <MarkdownToolbar editor={editor} />
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
            <div className={styles.previewContainer} onDoubleClick={handleEdit}>
              {details ? (
                <MarkdownView source={details} onChange={handleDetailsChange} className={styles.markdownScroll} />
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
