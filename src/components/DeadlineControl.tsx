import { type FC, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import styles from './DeadlineControl.module.scss';
import { useFocus } from '../contexts/FocusContext';
import { useNow } from '../hooks/useNow';
import { soundEngine } from '../utils/audio';
import { deadlineState, defaultDeadline, formatDeadline, fromInputValue, toInputValue } from '../utils/deadline';
import { DeadlineIcon } from './DeadlineBadge';

interface DeadlineControlProps {
  objectiveId: number;
  deadline: string | null | undefined;
}

// The details header's deadline: "no deadline" until clicked, then the date with a picker and a remove button
export const DeadlineControl: FC<DeadlineControlProps> = ({ objectiveId, deadline }) => {
  const { setObjectiveDeadline } = useFocus();
  const now = useNow();
  const inputRef = useRef<HTMLInputElement>(null);

  if (!deadline) {
    return (
      <button
        type="button"
        className={styles.none}
        onClick={() => { soundEngine.playClick(); void setObjectiveDeadline(objectiveId, defaultDeadline(new Date())); }}
        title="Set a deadline (next working day, 19:00)"
      >
        NO_DEADLINE
      </button>
    );
  }

  const state = deadlineState(deadline, now);

  const openPicker = () => {
    soundEngine.playClick();
    const input = inputRef.current;
    if (!input) return;
    // showPicker is missing in older engines; focusing still lets the keyboard edit the fields
    if (input.showPicker) input.showPicker();
    else input.focus();
  };

  return (
    <span className={`${styles.set} ${styles[state]}`} data-deadline-state={state}>
      <button type="button" className={styles.date} onClick={openPicker} title="Change the deadline" aria-label={`Deadline ${formatDeadline(deadline, now)}`}>
        <DeadlineIcon state={state} size={13} />
        <span>{formatDeadline(deadline, now)}</span>
      </button>
      <input
        ref={inputRef}
        type="datetime-local"
        className={styles.picker}
        aria-label="Deadline date and time"
        value={toInputValue(deadline)}
        onChange={e => {
          const next = fromInputValue(e.target.value);
          if (next) void setObjectiveDeadline(objectiveId, next);
        }}
        tabIndex={-1}
      />
      <button
        type="button"
        className={styles.remove}
        onClick={() => { soundEngine.playClick(); void setObjectiveDeadline(objectiveId, null); }}
        title="Remove the deadline"
        aria-label="Remove deadline"
      >
        <Trash2 size={13} />
      </button>
    </span>
  );
};
