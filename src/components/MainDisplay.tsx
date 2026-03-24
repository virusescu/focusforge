import { useState, useEffect, type FC } from 'react';
import styles from './MainDisplay.module.scss';
import { Play, Pause, RotateCcw, Zap } from 'lucide-react';
import { getUserSettings } from '../db';

export const MainDisplay: FC = () => {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [multiplier, setMultiplier] = useState(1);

  useEffect(() => {
    async function loadSettings() {
      const settings = await getUserSettings();
      if (settings) {
        setMultiplier(settings.debug_speed || 1);
      }
    }
    loadSettings();

    // Refresh settings when they are updated in the modal
    const handleUpdate = () => loadSettings();
    window.addEventListener('user-settings-updated', handleUpdate);
    return () => window.removeEventListener('user-settings-updated', handleUpdate);
  }, []);

  useEffect(() => {
    let interval: number | undefined;
    if (isActive) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + multiplier);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, multiplier]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.floor(totalSeconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTimer = () => {
    const nextState = !isActive;
    setIsActive(nextState);
    if (nextState) {
      window.dispatchEvent(new CustomEvent('timer-active'));
    } else {
      window.dispatchEvent(new CustomEvent('timer-paused'));
    }
  };

  const resetTimer = () => {
    setIsActive(false);
    setSeconds(0);
    window.dispatchEvent(new CustomEvent('timer-reset'));
  };

  // Circle Math
  const circumference = 2 * Math.PI * 140; // ~879.6
  
  const minutes = seconds / 60;
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
      
      <div className={styles.controls}>
        <button onClick={toggleTimer} className={styles.btnPrimary}>
          {isActive ? <Pause size={24} /> : <Play size={24} />}
          <span>{isActive ? 'HALT_PROCESS' : 'INITIATE_FORGE'}</span>
        </button>
        <button onClick={resetTimer} className={styles.btnSecondary}>
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
