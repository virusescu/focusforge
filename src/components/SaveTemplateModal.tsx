import { type FC, useId, useMemo, useState } from 'react';
import { ModalFrame } from './ModalFrame';
import form from './TemplateForm.module.scss';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine } from '../utils/audio';
import { extractFields } from '../utils/templates';
import type { StrategicObjective } from '../types';

const ACCENT = '#ee682b';

interface SaveTemplateModalProps {
  task: StrategicObjective;
  onClose: () => void;
}

// "Create template from task": copies the task's title, details and category. The task itself is untouched.
export const SaveTemplateModal: FC<SaveTemplateModalProps> = ({ task, onClose }) => {
  const { categories, addTemplate } = useFocus();
  const id = useId();
  const [name, setName] = useState(task.text);
  const [color, setColor] = useState(() => categories.find(c => c.id === task.category_id)?.color ?? ACCENT);

  const details = task.details ?? '';
  const fields = useMemo(() => extractFields(task.text, details), [task.text, details]);
  const canSave = name.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    soundEngine.playClick();
    void addTemplate({ name: name.trim(), title: task.text, details, color, category_id: task.category_id ?? null });
    onClose();
  };

  return (
    <ModalFrame
      title="CREATE_TEMPLATE"
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <button className={form.secondaryBtn} onClick={onClose}>CANCEL</button>
          <button className={form.primaryBtn} onClick={save} disabled={!canSave}>SAVE_TEMPLATE</button>
        </>
      }
    >
      <div className={form.nameRow}>
        <div className={form.field} style={{ flex: 1 }}>
          <label htmlFor={`${id}-name`}>NAME</label>
          <input
            id={`${id}-name`}
            className={form.input}
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            onFocus={e => e.currentTarget.select()}
          />
        </div>
        <div className={form.field}>
          <label htmlFor={`${id}-color`}>COLOR</label>
          <input id={`${id}-color`} type="color" className={form.colorInput} value={color} onChange={e => setColor(e.target.value)} />
        </div>
      </div>

      <div className={form.field}>
        <label>FIELDS</label>
        {fields.length > 0 ? (
          <div className={form.fieldChips}>
            {fields.map(f => <span key={f} className={form.chip}>${f}</span>)}
          </div>
        ) : (
          <span className={form.hint}>No fields. Write $name in the title or details to add one.</span>
        )}
      </div>
    </ModalFrame>
  );
};
