import { type FC, useId, useMemo, useRef, useState } from 'react';
import { ModalFrame } from './ModalFrame';
import form from './TemplateForm.module.scss';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine } from '../utils/audio';
import { extractFields, fillTemplate } from '../utils/templates';
import { firstValidBucketId, firstValidCategoryId, loadLastPicks, saveLastPicks } from '../utils/lastPicks';
import type { Template } from '../types';

interface CreateFromTemplateModalProps {
  template: Template;
  // Bucket to preselect (the panel it was opened from); otherwise the last bucket used
  defaultBucketId?: number;
  // Whether "Add to Mission" starts checked (follows the add box of the surface it was opened from)
  defaultInMission: boolean;
  onClose: () => void;
}

export const CreateFromTemplateModal: FC<CreateFromTemplateModalProps> = ({ template, defaultBucketId, defaultInMission, onClose }) => {
  const { buckets, categories, addObjective } = useFocus();
  const id = useId();
  const fields = useMemo(() => extractFields(template.title, template.details), [template.title, template.details]);
  const holdingBuckets = useMemo(() => buckets.filter(b => b.kind !== 'mission'), [buckets]);

  const [values, setValues] = useState<Record<string, string>>({});
  const [bucketId, setBucketId] = useState<number | null>(() =>
    firstValidBucketId([defaultBucketId, loadLastPicks().bucketId], buckets));
  const [categoryId, setCategoryId] = useState<number | null>(() =>
    firstValidCategoryId([template.category_id, loadLastPicks().categoryId], categories));
  const [inMission, setInMission] = useState(defaultInMission);
  const submitted = useRef(false);

  const title = fillTemplate(template.title, values).trim();
  const canCreate = title.length > 0;

  const create = () => {
    if (!canCreate || submitted.current) return;
    submitted.current = true;
    const filledDetails = fillTemplate(template.details, values);
    soundEngine.playClick();
    saveLastPicks({ bucketId, categoryId });
    void addObjective(title, categoryId, false, {
      bucketId,
      inMission,
      details: filledDetails.trim() ? filledDetails : null,
    });
    onClose();
  };

  return (
    <ModalFrame
      title={template.name}
      onClose={onClose}
      onSubmit={create}
      footer={
        <>
          <button className={form.secondaryBtn} onClick={onClose}>CANCEL</button>
          <button className={form.primaryBtn} onClick={create} disabled={!canCreate}>CREATE_TASK</button>
        </>
      }
    >
      {fields.map((name, i) => (
        <div key={name} className={form.field}>
          <label htmlFor={`${id}-${name}`}>{name}</label>
          <input
            id={`${id}-${name}`}
            aria-label={name}
            className={form.input}
            value={values[name] ?? ''}
            onChange={e => setValues(prev => ({ ...prev, [name]: e.target.value }))}
            autoFocus={i === 0}
          />
        </div>
      ))}

      <div className={form.row}>
        <div className={form.field}>
          <label htmlFor={`${id}-bucket`}>BUCKET</label>
          <select
            id={`${id}-bucket`}
            className={form.select}
            value={bucketId ?? ''}
            onChange={e => setBucketId(Number(e.target.value))}
          >
            {holdingBuckets.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className={form.field}>
          <label htmlFor={`${id}-category`}>CATEGORY</label>
          <select
            id={`${id}-category`}
            className={form.select}
            value={categoryId ?? ''}
            onChange={e => setCategoryId(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">No category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      </div>

      <label className={form.checkbox}>
        <input type="checkbox" checked={inMission} onChange={e => setInMission(e.target.checked)} />
        <span>ADD_TO_MISSION</span>
      </label>
    </ModalFrame>
  );
};
