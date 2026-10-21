import { type FC } from 'react';
import { GripVertical } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { ModalFrame } from './ModalFrame';
import form from './TemplateForm.module.scss';
import styles from './TabOrderModal.module.scss';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine } from '../utils/audio';
import { focusOrder } from '../utils/buckets';
import type { Bucket } from '../types';

const Row: FC<{ bucket: Bucket; position: number }> = ({ bucket, position }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: bucket.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 1 : undefined }}
      className={styles.row}
      data-bucket-row={bucket.id}
      {...attributes}
      {...listeners}
    >
      <GripVertical size={14} className={styles.grip} />
      <span className={styles.position}>{position}</span>
      <span className={styles.swatch} style={{ backgroundColor: bucket.color }} />
      <span className={styles.name}>{bucket.kind === 'mission' ? 'MISSION_OBJECTIVES' : bucket.kind === 'deadlines' ? 'DEADLINES' : bucket.name}</span>
    </div>
  );
};

interface TabOrderModalProps {
  onClose: () => void;
}

// Drag the panels into the order Tab walks them in while one is focused on the canvas
export const TabOrderModal: FC<TabOrderModalProps> = ({ onClose }) => {
  const { buckets, reorderBucketTabs } = useFocus();
  const ordered = focusOrder(buckets);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ordered.findIndex(b => b.id === active.id);
    const to = ordered.findIndex(b => b.id === over.id);
    if (from === -1 || to === -1) return;
    soundEngine.playReorder();
    void reorderBucketTabs(arrayMove(ordered, from, to).map(b => b.id));
  };

  return (
    <ModalFrame
      title="TAB_ORDER"
      onClose={onClose}
      footer={<button className={form.secondaryBtn} onClick={onClose}>CLOSE</button>}
    >
      <p className={styles.hint}>The order Tab walks the panels in once one is focused (double-click a panel). Drag to reorder.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
        <SortableContext items={ordered.map(b => b.id)} strategy={verticalListSortingStrategy}>
          <div className={styles.list}>
            {ordered.map((b, i) => <Row key={b.id} bucket={b} position={i + 1} />)}
          </div>
        </SortableContext>
      </DndContext>
    </ModalFrame>
  );
};
