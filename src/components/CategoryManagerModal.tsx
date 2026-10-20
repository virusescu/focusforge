import { type FC, useState } from 'react';
import { X, Plus, Trash2, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import styles from './CategoryManagerModal.module.scss';
import type { ObjectiveCategory } from '../types';
import { soundEngine } from '../utils/audio';

interface Props {
  categories: ObjectiveCategory[];
  onAdd: (label: string, color: string, coinBounty?: number) => Promise<void>;
  onUpdate: (id: number, label: string, color: string, coinBounty?: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onReorder: (orderedIds: number[]) => Promise<void>;
  onClose: () => void;
  objectiveCountByCategory: Map<number, number>;
}

interface CategoryRowProps {
  cat: ObjectiveCategory;
  pendingDelete: boolean;
  usageCount: number;
  onLabelChange: (cat: ObjectiveCategory, label: string) => void;
  onColorChange: (cat: ObjectiveCategory, color: string) => void;
  onBountyChange: (cat: ObjectiveCategory, bounty: string) => void;
  onDelete: (cat: ObjectiveCategory) => void;
  onConfirmDelete: (id: number) => void;
  onCancelDelete: () => void;
}

const CategoryRow: FC<CategoryRowProps> = ({
  cat, pendingDelete, usageCount, onLabelChange, onColorChange, onBountyChange, onDelete, onConfirmDelete, onCancelDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={styles.categoryRow}>
      <button
        className={styles.dragHandle}
        // Only the handle starts a drag, so the inputs in the row stay editable
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${cat.label}`}
        title="Drag to reorder"
      >
        <GripVertical size={14} />
      </button>
      <input
        type="color"
        className={styles.colorInput}
        value={cat.color}
        onChange={(e) => onColorChange(cat, e.target.value)}
        title="Change color"
      />
      <input
        className={styles.labelInput}
        defaultValue={cat.label}
        onBlur={(e) => onLabelChange(cat, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
      <input
        className={styles.bountyInput}
        type="number"
        defaultValue={cat.coin_bounty}
        min="0"
        onBlur={(e) => onBountyChange(cat, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        title="Coin bounty"
      />
      <span className={styles.bountyIcon}>⟐</span>
      <button
        className={styles.deleteBtn}
        onClick={() => onDelete(cat)}
        onMouseEnter={() => soundEngine.playHover()}
        title="Delete Category"
      >
        <Trash2 size={12} />
      </button>

      {pendingDelete && (
        <div className={styles.deleteConfirm}>
          <span>{usageCount} objective(s) use this tag. Delete?</span>
          <button className={styles.confirmYes} onClick={() => onConfirmDelete(cat.id)}>YES</button>
          <button className={styles.confirmNo} onClick={onCancelDelete}>NO</button>
        </div>
      )}
    </div>
  );
};

export const CategoryManagerModal: FC<Props> = ({ categories, onAdd, onUpdate, onDelete, onReorder, onClose, objectiveCountByCategory }) => {
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleLabelChange = (cat: ObjectiveCategory, newLabel: string) => {
    if (newLabel.trim() && newLabel !== cat.label) {
      onUpdate(cat.id, newLabel.trim(), cat.color, cat.coin_bounty);
    }
  };

  const handleColorChange = (cat: ObjectiveCategory, newColor: string) => {
    onUpdate(cat.id, cat.label, newColor, cat.coin_bounty);
  };

  const handleBountyChange = (cat: ObjectiveCategory, newBounty: string) => {
    const value = Math.max(0, parseInt(newBounty) || 0);
    onUpdate(cat.id, cat.label, cat.color, value);
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = categories.findIndex(c => c.id === active.id);
    const to = categories.findIndex(c => c.id === over.id);
    if (from === -1 || to === -1) return;
    soundEngine.playReorder();
    onReorder(arrayMove(categories, from, to).map(c => c.id));
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

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        >
          <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className={styles.list}>
              {categories.map(cat => (
                <CategoryRow
                  key={cat.id}
                  cat={cat}
                  pendingDelete={pendingDelete === cat.id}
                  usageCount={objectiveCountByCategory.get(cat.id) ?? 0}
                  onLabelChange={handleLabelChange}
                  onColorChange={handleColorChange}
                  onBountyChange={handleBountyChange}
                  onDelete={handleDelete}
                  onConfirmDelete={confirmDelete}
                  onCancelDelete={() => setPendingDelete(null)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

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
