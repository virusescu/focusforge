import { type FC, useId, useMemo, useRef, useState } from 'react';
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitted = useRef(false);
  const canSave = name.trim().length > 0;

  // Stays open until the save has gone through, so a failed save loses nothing the user typed
  const save = async () => {
    if (!canSave || submitted.current) return;
    submitted.current = true;
    setSaving(true);
    setError(null);
    soundEngine.playClick();
    try {
      await addTemplate({ name: name.trim(), title: task.text, details, color, category_id: task.category_id ?? null });
    } catch (e) {
      console.error('Saving the template failed', e);
      submitted.current = false;
      setSaving(false);
      setError('Could not save. Check your connection and try again.');
      return;
    }
    onClose();
  };

  return (
    <ModalFrame
      title="CREATE_TEMPLATE"
      onClose={onClose}
      onSubmit={() => { void save(); }}
      footer={
        <>
          <button className={form.secondaryBtn} onClick={onClose}>CANCEL</button>
          <button className={form.primaryBtn} onClick={() => { void save(); }} disabled={!canSave || saving}>{saving ? 'SAVING...' : 'SAVE_TEMPLATE'}</button>
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

      {error && <div className={form.error} role="alert">{error}</div>}
    </ModalFrame>
  );
};
