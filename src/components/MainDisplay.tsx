import { type FC, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import styles from './MainDisplay.module.scss';
import { Play, Pause, RotateCcw, Zap, Target } from 'lucide-react';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine } from '../utils/audio';

export const MainDisplay: FC<{ onViewAnalytics?: () => void }> = ({ onViewAnalytics }) => {
  const { 
    activeObjectiveId, 
    objectivePool, 
    neutralizeObjective,
    seconds,
    isActive,
    minutes,
    pauseSeconds,
    pauseLimit,
    toggleTimer,
    resetTimer,
    formatTime
  } = useFocus();

  const [charge, setCharge] = useState(0);
  const chargeRef = useRef(0);
  const lastClickTime = useRef(0);

  const activeObjective = useMemo(() => 
    objectivePool.find(o => o.id === activeObjectiveId),
    [objectivePool, activeObjectiveId]
  );

  const handleNeutralize = useCallback(() => {
    if (activeObjectiveId !== null) {
      neutralizeObjective(activeObjectiveId);
      setCharge(0);
      chargeRef.current = 0;
    }
  }, [activeObjectiveId, neutralizeObjective]);

  const handleChargeClick = useCallback(() => {
    const now = Date.now();
    soundEngine.playClick();
    
    // Each click adds 0.3 to the charge (approx 4-5 clicks to trigger)
    const newCharge = Math.min(chargeRef.current + 0.3, 1);
    setCharge(newCharge);
    chargeRef.current = newCharge;
    lastClickTime.current = now;

    if (newCharge >= 1) {
      handleNeutralize();
    }
  }, [handleNeutralize]);

  // Decay charge over time
  useEffect(() => {
    if (charge === 0 && chargeRef.current === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      // Only decay if user hasn't clicked in the last 150ms
      if (now - lastClickTime.current > 150) {
        const decayAmount = 0.5 / 60; // 0.5 per second, 60 ticks per second
        const newCharge = Math.max(chargeRef.current - decayAmount, 0);
        setCharge(newCharge);
        chargeRef.current = newCharge;
      }
    }, 16); // ~60fps for smooth decay

    return () => clearInterval(interval);
  }, [charge]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
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

  const remainingPause = pauseLimit - pauseSeconds;
  const isPaused = !isActive && seconds > 0;
  const pauseUrgency = remainingPause < 10 ? styles.critical : remainingPause < 30 ? styles.warning : '';

  // Each segment has its own length (arc) and its own internal progress
  const getSegmentOffset = (current: number, max: number, segmentArc: number) => {
    const progress = Math.min(Math.max(current, 0) / max, 1);
    return segmentArc * (1 - progress);
  };

  return (
    <main className={styles.container}>
      {activeObjective && (
        <div 
          className={styles.objectiveHUD} 
          onClick={handleChargeClick}
        >
          <span className={styles.hudLabel}>ACTIVE_OBJECTIVE // LOCKED_ON</span>
          <div className={styles.hudText}>{activeObjective.text}</div>
        </div>
      )}

      {charge > 0 && (
        <div 
          className={styles.fullScreenCharge}
          style={{ height: `${charge * 100}vh` }}
        />
      )}

      <div className={`${styles.slidingChargeBar} ${charge > 0 ? styles.active : ''}`}>
        <div className={styles.chargeContent}>
          <Target size={20} className={styles.chargeIcon} />
          <div className={styles.chargeInfo}>
            <span className={styles.chargePercent}>{Math.floor(charge * 100)}%</span>
            <span className={styles.chargeAction}>NEUTRALIZING_TARGET...</span>
          </div>
          <div className={styles.chargeGlow} style={{ width: `${charge * 100}%` }} />
        </div>
      </div>

      <div className={`${styles.timerCircle} ${isOverLimit ? styles.limitReached : ''} ${isPaused ? styles.timerPaused : ''}`}>
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
          <div className={styles.label}>
            {isPaused ? 'PAUSE_LIMIT_ENFORCED' : isOverLimit ? 'LIMIT_EXCEEDED' : 'NEURAL_FORGE_ACTIVE'}
          </div>
          <div className={styles.time}>
            {formatTime(seconds)}
          </div>
          <div className={`${styles.subLabel} ${isPaused ? `${styles.rebootTimer} ${pauseUrgency}` : ''}`}>
            {isPaused ? `REBOOT_IN: ${formatTime(remainingPause)}` : `TARGET_DEPTH: ${Math.min(Math.floor((minutes / 30) * 100), 100)}%`}
          </div>
        </div>
      </div>
      
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
      
      <div className={`${styles.boostBanner} ${isOverLimit ? styles.limitBanner : ''}`}>
        <Zap size={16} className={styles.zapIcon} />
        <span>{performance} PERFORMANCE</span>
      </div>

      <div className={styles.decoration}>
        <div className={styles.gridLine} />
        <div className={styles.gridLine} />
        <div className={styles.gridLine} />
      </div>
    </main>
  );
};
