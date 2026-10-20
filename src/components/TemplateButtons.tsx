import { type FC, useCallback, useState } from 'react';
import styles from './TemplateButtons.module.scss';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine } from '../utils/audio';
import { CreateFromTemplateModal } from './CreateFromTemplateModal';
import type { Template } from '../types';

interface TemplateButtonsProps {
  // Set on a bucket panel so the dialog starts on that bucket
  defaultBucketId?: number;
  // Whether the dialog's "Add to Mission" starts checked (same as the add box beside these buttons)
  defaultInMission: boolean;
  className?: string;
}

// One button per template, in the user's order, under an add box
export const TemplateButtons: FC<TemplateButtonsProps> = ({ defaultBucketId, defaultInMission, className }) => {
  const { templates } = useFocus();
  const [active, setActive] = useState<Template | null>(null);
  const close = useCallback(() => setActive(null), []);

  if (templates.length === 0) return null;

  return (
    <>
      <div className={`${styles.row} ${className ?? ''}`} data-canvas-scroll>
        {templates.map(t => (
          <button
            key={t.id}
            className={styles.button}
            style={{ '--btn-color': t.color } as React.CSSProperties}
            onClick={e => { e.stopPropagation(); soundEngine.playClick(); setActive(t); }}
            title={`New task from template: ${t.name}`}
          >
            {t.name}
          </button>
        ))}
      </div>
      {active && (
        <CreateFromTemplateModal
          template={active}
          defaultBucketId={defaultBucketId}
          defaultInMission={defaultInMission}
          onClose={close}
        />
      )}
    </>
  );
};
