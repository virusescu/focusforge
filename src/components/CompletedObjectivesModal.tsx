import { type FC, useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './CompletedObjectivesModal.module.scss';
import { X, Edit3, Check, Trash2 } from 'lucide-react';
import type { StrategicObjective, ObjectiveCategory } from '../types';
import { soundEngine } from '../utils/audio';
import { CategoryDotPicker } from './CategoryDotPicker';

interface Props {
  objectives: StrategicObjective[];
  categories: ObjectiveCategory[];
  onDelete: (id: number) => Promise<void>;
  onUpdate: (id: number, text: string, categoryId?: number | null) => Promise<void>;
  onUpdateTime: (id: number, completedAt: string) => Promise<void>;
  onClose: () => void;
  onManageCategories: () => void;
}

const toDatetimeLocal = (date: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const CompletedObjectivesModal: FC<Props> = ({ objectives, categories, onDelete, onUpdate, onUpdateTime, onClose, onManageCategories }) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editingTimeId, setEditingTimeId] = useState<number | null>(null);
  const [editTimeValue, setEditTimeValue] = useState('');
  const [pickerOpenId, setPickerOpenId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId !== null && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingId]);

  const handleClose = useCallback(() => {
    soundEngine.playClick();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (editingId !== null) {
          setEditingId(null);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [editingId, handleClose]);

  const handleStartEdit = (obj: StrategicObjective) => {
    soundEngine.playClick();
    setEditingId(obj.id);
    setEditText(obj.text);
  };

  const handleSaveEdit = async (obj: StrategicObjective) => {
    if (editText.trim() && editText !== obj.text) {
      await onUpdate(obj.id, editText.trim(), obj.category_id);
    }
    setEditingId(null);
    soundEngine.playClick();
  };

  const handleCategoryChange = async (obj: StrategicObjective, categoryId: number | null) => {
    await onUpdate(obj.id, obj.text, categoryId);
    setPickerOpenId(null);
  };

  const handleStartTimeEdit = (obj: StrategicObjective) => {
    soundEngine.playClick();
    setEditingTimeId(obj.id);
    setEditTimeValue(obj.completed_at ? toDatetimeLocal(new Date(obj.completed_at)) : '');
  };

  const handleSaveTimeEdit = async (obj: StrategicObjective) => {
    if (editTimeValue) {
      const newDate = new Date(editTimeValue);
      await onUpdateTime(obj.id, newDate.toISOString());
    }
    setEditingTimeId(null);
    soundEngine.playClick();
  };

  const handleDelete = async (id: number) => {
    soundEngine.playClick();
    await onDelete(id);
  };

  return createPortal(
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>COMPLETED_OBJECTIVES ({objectives.length})</h3>
          <button className={styles.closeBtn} onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.list}>
          {objectives.map(obj => {
            const catColor = categories.find(c => c.id === obj.category_id)?.color || '#333333';
            const isEditing = editingId === obj.id;
            const showPicker = pickerOpenId === obj.id;

            return (
              <div key={obj.id} className={styles.item}>
                <span
                  className={styles.bullet}
                  style={{ backgroundColor: catColor }}
                  onClick={() => setPickerOpenId(showPicker ? null : obj.id)}
                  title="Change category"
                />

                {showPicker && (
                  <div className={styles.pickerWrapper} onClick={e => e.stopPropagation()}>
                    <CategoryDotPicker
                      categories={categories}
                      selectedCategoryId={obj.category_id ?? null}
                      onSelect={(catId) => handleCategoryChange(obj, catId)}
                      onManage={onManageCategories}
                    />
                  </div>
                )}

                {editingTimeId === obj.id ? (
                  <div className={styles.timeEditForm}>
                    <input
                      type="date"
                      value={editTimeValue.slice(0, 10)}
                      onChange={e => {
                        const date = e.target.value;
                        const time = editTimeValue.slice(11, 16);
                        setEditTimeValue(date ? `${date}T${time || '00:00'}` : '');
                      }}
                      className={styles.dateTimeInput}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveTimeEdit(obj);
                        else if (e.key === 'Escape') {
                          e.stopPropagation();
                          setEditingTimeId(null);
                        }
                      }}
                    />
                    <input
                      type="text"
                      placeholder="HH:MM"
                      value={editTimeValue.slice(11, 16)}
                      onChange={e => {
                        const timeStr = e.target.value.replace(/[^\d:]/g, '').slice(0, 5);
                        const date = editTimeValue.slice(0, 10);
                        if (date && timeStr.length === 5 && timeStr[2] === ':') {
                          setEditTimeValue(`${date}T${timeStr}`);
                        } else if (date) {
                          setEditTimeValue(`${date}T${timeStr.padEnd(5, ':')}`);
                        }
                      }}
                      className={styles.dateTimeInput}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveTimeEdit(obj);
                        else if (e.key === 'Escape') {
                          e.stopPropagation();
                          setEditingTimeId(null);
                        }
                      }}
                      autoFocus
                    />
                    <button className={styles.timeSaveBtn} onClick={() => handleSaveTimeEdit(obj)}>
                      <Check size={10} />
                    </button>
                  </div>
                ) : (
                  <span
                    className={styles.time}
                    onClick={() => handleStartTimeEdit(obj)}
                    title="Edit completion time"
                  >
                    {obj.completed_at
                      ? new Date(obj.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
                      : ''}
                  </span>
                )}

                {isEditing ? (
                  <div className={styles.editForm}>
                    <input
                      ref={inputRef}
                      className={styles.editInput}
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveEdit(obj);
                        else if (e.key === 'Escape') {
                          e.stopPropagation();
                          setEditingId(null);
                        }
                      }}
                    />
                    <button className={styles.saveBtn} onClick={() => handleSaveEdit(obj)}>
                      <Check size={12} />
                    </button>
                  </div>
                ) : (
                  <span className={styles.text}>{obj.text}</span>
                )}

                <div className={styles.actions}>
                  {!isEditing && (
                    <button
                      className={styles.editBtn}
                      onClick={() => handleStartEdit(obj)}
                      onMouseEnter={() => soundEngine.playHover()}
                      title="Edit"
                    >
                      <Edit3 size={12} />
                    </button>
                  )}
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(obj.id)}
                    onMouseEnter={() => soundEngine.playHover()}
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}

          {objectives.length === 0 && (
            <div className={styles.empty}>NO_OBJECTIVES_REMAINING</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
