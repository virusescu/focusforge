import { type FC, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import styles from './CategoryManagerModal.module.scss';
import type { ObjectiveCategory } from '../types';
import { soundEngine } from '../utils/audio';

interface Props {
  categories: ObjectiveCategory[];
  onAdd: (label: string, color: string) => Promise<void>;
  onUpdate: (id: number, label: string, color: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onClose: () => void;
  objectiveCountByCategory: Map<number, number>;
}

export const CategoryManagerModal: FC<Props> = ({ categories, onAdd, onUpdate, onDelete, onClose, objectiveCountByCategory }) => {
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  const handleLabelChange = (cat: ObjectiveCategory, newLabel: string) => {
    if (newLabel.trim() && newLabel !== cat.label) {
      onUpdate(cat.id, newLabel.trim(), cat.color);
    }
  };

  const handleColorChange = (cat: ObjectiveCategory, newColor: string) => {
    onUpdate(cat.id, cat.label, newColor);
  };

  const handleDelete = (cat: ObjectiveCategory) => {
    const count = objectiveCountByCategory.get(cat.id) || 0;
    if (count > 0) {
      setPendingDelete(cat.id);
    } else {
      soundEngine.playClick();
      onDelete(cat.id);
    }
  };

  const confirmDelete = (id: number) => {
    soundEngine.playClick();
    onDelete(id);
    setPendingDelete(null);
  };

  const handleAddNew = () => {
    soundEngine.playClick();
    onAdd('New Tag', '#666666');
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>MANAGE_CATEGORIES</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.list}>
          {categories.map(cat => (
            <div key={cat.id} className={styles.categoryRow}>
              <input
                type="color"
                className={styles.colorInput}
                value={cat.color}
                onChange={(e) => handleColorChange(cat, e.target.value)}
                title="Change color"
              />
              <input
                className={styles.labelInput}
                defaultValue={cat.label}
                onBlur={(e) => handleLabelChange(cat, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
              />
              <button
                className={styles.deleteBtn}
                onClick={() => handleDelete(cat)}
                onMouseEnter={() => soundEngine.playHover()}
                title="Delete Category"
              >
                <Trash2 size={12} />
              </button>

              {pendingDelete === cat.id && (
                <div className={styles.deleteConfirm}>
                  <span>{objectiveCountByCategory.get(cat.id)} objective(s) use this tag. Delete?</span>
                  <button className={styles.confirmYes} onClick={() => confirmDelete(cat.id)}>YES</button>
                  <button className={styles.confirmNo} onClick={() => setPendingDelete(null)}>NO</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          className={styles.addBtn}
          onClick={handleAddNew}
          onMouseEnter={() => soundEngine.playHover()}
        >
          <Plus size={12} />
          <span>ADD_CATEGORY</span>
        </button>
      </div>
    </div>
  );
};
