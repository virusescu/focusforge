import type { FC } from 'react';
import { AlarmClock, AlertTriangle, Clock } from 'lucide-react';
import styles from './DeadlineBadge.module.scss';
import { useNow } from '../hooks/useNow';
import { deadlineState, formatDeadline, type DeadlineState } from '../utils/deadline';

const LABELS: Record<DeadlineState, string> = { later: 'Deadline', soon: 'Deadline soon', overdue: 'Deadline passed' };

export const DeadlineIcon: FC<{ state: DeadlineState; size?: number }> = ({ state, size = 12 }) => {
  if (state === 'overdue') return <AlarmClock size={size} className={styles.overdueIcon} />;
  if (state === 'soon') return <AlertTriangle size={size} />;
  return <Clock size={size} />;
};

interface DeadlineBadgeProps {
  deadline: string; // ISO
  showText?: boolean; // task rows show just the icon
  className?: string;
}

// A deadline's icon (and date): muted when far off, yellow today and tomorrow, red once it has passed
export const DeadlineBadge: FC<DeadlineBadgeProps> = ({ deadline, showText = false, className }) => {
  const now = useNow();
  const state = deadlineState(deadline, now);
  const text = formatDeadline(deadline, now);
  return (
    <span
      className={`${styles.badge} ${styles[state]} ${showText ? styles.withText : ''} ${className ?? ''}`}
      data-deadline-state={state}
      title={`${LABELS[state]}: ${text}`}
    >
      <DeadlineIcon state={state} />
      {showText && <span>{text}</span>}
    </span>
  );
};
