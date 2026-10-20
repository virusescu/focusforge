import { type FC, useEffect, useId, useMemo, useRef, useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { ModalFrame } from './ModalFrame';
import form from './TemplateForm.module.scss';
import styles from './TemplateManagerModal.module.scss';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine } from '../utils/audio';
import { extractFields } from '../utils/templates';
import type { ObjectiveCategory, Template, TemplateInput } from '../types';

interface TemplateRowProps {
  template: Template;
  categories: ObjectiveCategory[];
  onUpdate: (id: number, template: TemplateInput) => void;
  onDelete: (id: number) => void;
}

const toInput = (t: TemplateInput): TemplateInput => ({ name: t.name, title: t.title, details: t.details, color: t.color, category_id: t.category_id });

const sameInput = (a: TemplateInput, b: TemplateInput) =>
  a.name === b.name && a.title === b.title && a.details === b.details && a.color === b.color && a.category_id === b.category_id;

const TemplateRow: FC<TemplateRowProps> = ({ template, categories, onUpdate, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: template.id });
  const id = useId();
  const [draft, setDraft] = useState<TemplateInput>(() => toInput(template));
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const fields = useMemo(() => extractFields(draft.title, draft.details), [draft.title, draft.details]);

  // Saves only what changed. Spaces around the name are a typo, so it is always trimmed (in the box too);
  // an emptied name goes back to the saved one instead of being saved blank.
  const commit = (next: TemplateInput) => {
    const name = next.name.trim() || template.name;
    if (name !== next.name) setDraft(prev => ({ ...prev, name }));
    const normalized = { ...next, name };
    if (sameInput(normalized, toInput(template))) return;
    onUpdate(template.id, normalized);
  };

  // The color picker fires "input" continuously while it is being dragged and "change" once when it is
  // dismissed. React's onChange covers the first (the swatch follows along); only the second saves.
  const colorRef = useRef<HTMLInputElement>(null);
  const latest = useRef({ draft, template, onUpdate });
  useEffect(() => { latest.current = { draft, template, onUpdate }; });
  useEffect(() => {
    const el = colorRef.current;
    if (!el) return;
    const handlePickerClosed = () => {
      const { draft: d, template: t, onUpdate: update } = latest.current;
      const next = { ...d, name: d.name.trim() || t.name, color: el.value };
      if (!sameInput(next, toInput(t))) update(t.id, next);
    };
    el.addEventListener('change', handlePickerClosed);
    return () => el.removeEventListener('change', handlePickerClosed);
  }, []);

  const change = (patch: Partial<TemplateInput>, saveNow = false) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (saveNow) commit(next);
  };

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={styles.card} data-template-id={template.id}>
      <div className={styles.cardHeader}>
        <button
          className={styles.handle}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${template.name}`}
          title="Drag to reorder"
        >
          <GripVertical size={14} />
        </button>
        <input
          ref={colorRef}
          id={`${id}-color`}
          aria-label="COLOR"
          type="color"
          className={form.colorInput}
          value={draft.color}
          onChange={e => change({ color: e.target.value })}
        />
        <input
          aria-label="NAME"
          className={form.input}
          value={draft.name}
          onChange={e => change({ name: e.target.value })}
          onBlur={() => commit(draft)}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
        <button className={styles.deleteBtn} onClick={() => setConfirmingDelete(true)} title="Delete template">
          <Trash2 size={13} />
        </button>
      </div>

      <div className={form.field}>
        <label htmlFor={`${id}-title`}>TITLE</label>
        <input
          id={`${id}-title`}
          className={form.input}
          value={draft.title}
          onChange={e => change({ title: e.target.value })}
          onBlur={() => commit(draft)}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
      </div>

      <div className={form.field}>
        <label htmlFor={`${id}-details`}>DETAILS</label>
        <textarea
          id={`${id}-details`}
          className={form.textarea}
          value={draft.details}
          onChange={e => change({ details: e.target.value })}
          onBlur={() => commit(draft)}
          spellCheck={false}
        />
      </div>

      <div className={form.row}>
        <div className={form.field}>
          <label htmlFor={`${id}-category`}>CATEGORY</label>
          <select
            id={`${id}-category`}
            className={form.select}
            value={draft.category_id ?? ''}
            onChange={e => change({ category_id: e.target.value === '' ? null : Number(e.target.value) }, true)}
          >
            <option value="">No category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className={form.field}>
          <label>FIELDS</label>
          {fields.length > 0 ? (
            <div className={form.fieldChips}>
              {fields.map(f => <span key={f} className={form.chip}>${f}</span>)}
            </div>
          ) : (
            <span className={form.hint}>None</span>
          )}
        </div>
      </div>

      {confirmingDelete && (
        <div className={styles.confirm}>
          <span>Delete "{template.name}"? Tasks already made from it stay.</span>
          <button className={styles.confirmYes} onClick={() => { soundEngine.playClick(); onDelete(template.id); }}>YES</button>
          <button className={styles.confirmNo} onClick={() => setConfirmingDelete(false)}>NO</button>
        </div>
      )}
    </div>
  );
};

interface TemplateManagerModalProps {
  onClose: () => void;
}

export const TemplateManagerModal: FC<TemplateManagerModalProps> = ({ onClose }) => {
  const { templates, categories, updateTemplate, deleteTemplate, reorderTemplates } = useFocus();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = templates.findIndex(t => t.id === active.id);
    const to = templates.findIndex(t => t.id === over.id);
    if (from === -1 || to === -1) return;
    soundEngine.playReorder();
    void reorderTemplates(arrayMove(templates, from, to).map(t => t.id));
  };

  return (
    <ModalFrame
      title="MANAGE_TEMPLATES"
      onClose={onClose}
      wide
      footer={<button className={form.secondaryBtn} onClick={onClose}>CLOSE</button>}
    >
      {templates.length === 0 ? (
        <div className={styles.empty}>
          NO_TEMPLATES
          <span>Right-click a task and choose "Create template from task".</span>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        >
          <SortableContext items={templates.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className={styles.list}>
              {templates.map(t => (
                <TemplateRow
                  key={t.id}
                  template={t}
                  categories={categories}
                  onUpdate={(id, input) => { void updateTemplate(id, input); }}
                  onDelete={id => { void deleteTemplate(id); }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </ModalFrame>
  );
};
