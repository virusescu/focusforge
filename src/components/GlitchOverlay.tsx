import { type FC } from 'react';
import styles from './GlitchOverlay.module.scss';
import { useFocus } from '../contexts/FocusContext';

export const GlitchOverlay: FC = () => {
  const { isGlitching, completedObjectiveText } = useFocus();

  if (!isGlitching) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.bwLayer} />
      <div className={styles.glitchSlices} />
      <div className={styles.scanlines} />
      <div className={styles.noise} />
      <div className={styles.messageWrap}>
        <div className={styles.messageGlitch} data-text="OBJECTIVE_COMPLETED">OBJECTIVE_COMPLETED</div>
        {completedObjectiveText && (
          <div className={styles.objectiveName}>
            {completedObjectiveText.split('').map((char, i) => (
              <span
                key={i}
                className={styles.letter}
                style={{ animationDelay: `${0.55 + i * 0.06}s` }}
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            ))}
          </div>
        )}
        <div className={styles.messageSub}>TARGET_NEUTRALIZED // SYNC_CONFIRMED</div>
      </div>
    </div>
  );
};
