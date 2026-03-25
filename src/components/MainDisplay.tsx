import { type FC, useCallback, useEffect, useMemo } from 'react';
import styles from './MainDisplay.module.scss';
import { Play, Pause, RotateCcw, Zap, Target } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useFocus } from '../contexts/FocusContext';
import { useTimer } from '../hooks/useTimer';
import { soundEngine } from '../utils/audio';

export const MainDisplay: FC<{ onViewAnalytics?: () => void }> = ({ onViewAnalytics }) => {
  const { user } = useUser();
  const { activeObjectiveId, objectivePool, neutralizeObjective } = useFocus();
  const { seconds, isActive, minutes, pauseSeconds, pauseLimit, toggleTimer: baseToggle, resetTimer: baseReset, formatTime } = useTimer(user?.debug_speed || 1);

  const activeObjective = useMemo(() => 
    objectivePool.find(o => o.id === activeObjectiveId),
    [objectivePool, activeObjectiveId]
  );

  const handleNeutralize = useCallback(() => {
    if (activeObjectiveId !== null) {
      neutralizeObjective(activeObjectiveId);
    }
  }, [activeObjectiveId, neutralizeObjective]);

  const toggleTimer = useCallback(() => {
    if (isActive) {
      soundEngine.playPause();
    } else {
      soundEngine.playStart();
    }
    baseToggle();
  }, [isActive, baseToggle]);

  const resetTimer = useCallback(() => {
    if (seconds > 0) {
      soundEngine.playReboot();
      baseReset();
    } else {
      soundEngine.playDenied();
    }
  }, [seconds, baseReset]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input (though there are none on main page currently)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === ' ') {
        e.preventDefault();
        toggleTimer();
      } else if (e.key === 'Escape') {
        resetTimer();
      } else if (e.key === 'Enter' && e.ctrlKey) {
        if (activeObjectiveId !== null && isActive) {
          e.preventDefault();
          handleNeutralize();
        }
      } else if (e.key.toLowerCase() === 'a') {
        if (onViewAnalytics) {
          soundEngine.playClick();
          onViewAnalytics();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleTimer, resetTimer, onViewAnalytics, activeObjectiveId, isActive, handleNeutralize]);

  const handleHover = () => {
    soundEngine.playHover();
  };

  // Circle Math
  const circumference = 2 * Math.PI * 140; // ~879.6
  
  const isOverLimit = minutes >= 60;

  let performance = "80%";
  if (minutes >= 60) performance = "180%";
  else if (minutes >= 30) performance = "150%";
  else if (minutes >= 15) performance = "120%";

  // Each segment has its own length (arc) and its own internal progress
  const getSegmentOffset = (current: number, max: number, segmentArc: number) => {
    const progress = Math.min(Math.max(current, 0) / max, 1);
    return segmentArc * (1 - progress);
  };

  return (
    <main className={styles.container}>
      {activeObjective && (
        <div className={styles.objectiveHUD}>
          <span className={styles.hudLabel}>ACTIVE_OBJECTIVE // LOCKED_ON</span>
          <div className={styles.hudText}>{activeObjective.text}</div>
          <button
            onClick={handleNeutralize}
            onMouseEnter={handleHover}
            className={styles.btnNeutralizeHUD}
          >
            <Target size={16} />
            <span>NEUTRALIZE</span>
          </button>
        </div>
      )}

      <div className={`${styles.boostBanner} ${isOverLimit ? styles.limitBanner : ''}`}>
        <Zap size={16} className={styles.zapIcon} />
        <span>{performance} PERFORMANCE</span>
      </div>
      
      <div className={`${styles.timerCircle} ${isOverLimit ? styles.limitReached : ''}`}>
        <svg viewBox="0 0 320 320" className={styles.svg}>
          {/* Backing Circle for legibility */}
          <circle cx="160" cy="160" r="150" className={styles.backingCircle} />
          
          <circle cx="160" cy="160" r="140" className={styles.backgroundCircle} />
          
          {/* Performance Markers (outside pointing in) */}
          {/* 15m mark: 3 o'clock (90deg from top) */}
          {minutes < 15 && (
            <polygon points="160,2 165,12 155,12" className={styles.marker} style={{ transform: 'rotate(90deg)', transformOrigin: '160px 160px' }} />
          )}
          {/* 30m mark: 6 o'clock (180deg from top) */}
          {minutes < 30 && (
            <polygon points="160,2 165,12 155,12" className={styles.marker} style={{ transform: 'rotate(180deg)', transformOrigin: '160px 160px' }} />
          )}
          
          {/* Progress group: Rotated -90deg to start at 12 o'clock */}
          <g transform="rotate(-90 160 160)">
            {/* Chunk 1: 0-15m */}
            <circle 
              cx="160" cy="160" r="140" 
              className={`${styles.progressCircle} ${isOverLimit ? styles.finished : ''}`}
              style={{ 
                strokeDasharray: `${circumference / 4} ${circumference}`,
                strokeDashoffset: getSegmentOffset(minutes, 15, circumference / 4),
                transform: 'rotate(0deg)',
                transformOrigin: 'center'
              }}
            />

            {/* Chunk 2: 15-30m */}
            <circle 
              cx="160" cy="160" r="140" 
              className={`${styles.progressCircle} ${isOverLimit ? styles.finished : ''}`}
              style={{ 
                strokeDasharray: `${circumference / 4} ${circumference}`,
                strokeDashoffset: getSegmentOffset(minutes - 15, 15, circumference / 4),
                transform: 'rotate(90deg)',
                transformOrigin: 'center'
              }}
            />

            {/* Chunk 3: 30-60m */}
            <circle 
              cx="160" cy="160" r="140" 
              className={`${styles.progressCircle} ${isOverLimit ? styles.finished : ''}`}
              style={{ 
                strokeDasharray: `${circumference / 2} ${circumference}`,
                strokeDashoffset: getSegmentOffset(minutes - 30, 30, circumference / 2),
                transform: 'rotate(180deg)',
                transformOrigin: 'center'
              }}
            />
          </g>
        </svg>
        <div className={styles.timerContent}>
          <div className={styles.label}>{isOverLimit ? 'LIMIT_EXCEEDED' : 'NEURAL_FORGE_ACTIVE'}</div>
          <div className={styles.time}>{formatTime(seconds)}</div>
          <div className={styles.subLabel}>TARGET_DEPTH: {Math.min(Math.floor((minutes / 60) * 100), 100)}%</div>
        </div>
      </div>
      
      {!isActive && pauseSeconds > 0 && (() => {
        const remaining = pauseLimit - pauseSeconds;
        const urgency = remaining < 10 ? styles.pauseRed : remaining < 30 ? styles.pauseYellow : '';
        return (
          <div className={`${styles.pauseWarning} ${urgency}`}>
            <span className={styles.pauseLabel}>PAUSE_LIMIT_ENFORCED</span>
            <span className={styles.pauseCountdown}>
              REBOOT_IN {formatTime(remaining)}
            </span>
          </div>
        );
      })()}

      <div className={styles.controls}>
        <button 
          onClick={toggleTimer} 
          onMouseEnter={handleHover}
          className={styles.btnPrimary}
        >
          {isActive ? <Pause size={24} /> : <Play size={24} />}
          <span>{isActive ? 'HALT_PROCESS' : seconds > 0 ? 'RESUME_FORGE' : 'INITIATE_FORGE'}</span>
        </button>

        <button
          onClick={resetTimer} 
          onMouseEnter={handleHover}
          className={styles.btnSecondary}
        >
          <RotateCcw size={20} />
          <span>REBOOT_CYCLE</span>
        </button>
      </div>
      
      <div className={styles.decoration}>
        <div className={styles.gridLine} />
        <div className={styles.gridLine} />
        <div className={styles.gridLine} />
      </div>
    </main>
  );
};
