import React, { useState, useEffect, useRef } from 'react';
import styles from './AlarmOverlay.module.scss';
import type { Alarm } from '../types';
import { playAlarmFile, soundEngine } from '../utils/audio';
import { useAlarms } from '../contexts/AlarmContext';

interface AlarmOverlayProps {
  alarm: Alarm;
  onDismiss: () => void;
}

const AlarmOverlay: React.FC<AlarmOverlayProps> = ({ alarm, onDismiss }) => {
  const { snoozeAlarm, getSnoozeCount } = useAlarms();
  const [clickCount, setClickCount] = useState(0);
  const [isShattering, setIsShattering] = useState(false);
  const [snoozeHold, setSnoozeHold] = useState(0); // 0 to 5000ms
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const holdIntervalRef = useRef<number | null>(null);
  const decayIntervalRef = useRef<number | null>(null);

  const snoozeCount = getSnoozeCount(alarm.id);

  // Audio setup and reliable cleanup
  useEffect(() => {
    let audio: HTMLAudioElement | null = null;
    let isMounted = true;

    playAlarmFile().then(a => {
      if (!isMounted) {
        a.pause();
        return;
      }
      audio = a;
      audioRef.current = a;
    });

    return () => {
      isMounted = false;
      if (audio) {
        // Force stop immediately to prevent lingering sound
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 0;
        audioRef.current = null;
      }
    };
  }, []);

  // Click Count Decay logic
  useEffect(() => {
    decayIntervalRef.current = window.setInterval(() => {
      setClickCount(prev => Math.max(0, prev - 1));
    }, 1200);

    return () => {
      if (decayIntervalRef.current) clearInterval(decayIntervalRef.current);
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    if (isShattering) return;
    if ((e.target as HTMLElement).closest(`.${styles.snoozeContainer}`)) return;
    
    const nextCount = Math.min(5, clickCount + 1);
    setClickCount(nextCount);
    
    soundEngine.playChargeClick(nextCount);

    if (nextCount >= 5) {
      setIsShattering(true);
      // Fade out audio during shatter
      if (audioRef.current) {
        const a = audioRef.current;
        const fade = setInterval(() => {
          if (a.volume > 0.1) a.volume -= 0.1;
          else {
            a.pause();
            clearInterval(fade);
          }
        }, 50);
      }
      setTimeout(() => {
        onDismiss();
      }, 600);
    }
  };

  // Snooze Hold Logic
  const startSnoozeHold = () => {
    const startTime = Date.now();
    holdIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= 5000) {
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        snoozeAlarm(alarm.id, 5);
        soundEngine.playNeutralizeChime();
      } else {
        setSnoozeHold(elapsed);
      }
    }, 50);
  };

  const stopSnoozeHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
    setSnoozeHold(0);
  };

  const pulseScale = 1 + (clickCount * 0.4);
  const textScale = 1 + (clickCount * 0.15);
  const filterIntensity = `blur(${40 + clickCount * 10}px)`;

  return (
    <div 
      className={`${styles.overlay} ${isShattering ? styles.shattering : ''}`} 
      onClick={handleClick}
    >
      <div 
        className={styles.explosion} 
        style={{ 
          transform: `scale(${pulseScale})`,
          filter: filterIntensity
        }} 
      />
      <div className={styles.content} style={{ transform: `scale(${textScale})` }}>
        <h1 className={styles.title}>{alarm.title}</h1>
        <p className={styles.sub}>TIME_CRITICAL // {alarm.time}</p>
        {snoozeCount > 0 && (
          <p className={styles.snoozeInfo}>SNOOZED {snoozeCount} {snoozeCount === 1 ? 'TIME' : 'TIMES'}</p>
        )}
      </div>
      
      <div className={`${styles.clickCounter} ${clickCount > 0 ? styles.active : ''}`}>
        NEUTRALIZE_SEQUENCE: {clickCount} / 5
      </div>

      <div className={styles.snoozeContainer}>
        <button 
          className={styles.snoozeBtn}
          onMouseDown={startSnoozeHold}
          onMouseUp={stopSnoozeHold}
          onMouseLeave={stopSnoozeHold}
          onClick={e => e.stopPropagation()}
        >
          HOLD 5S TO SNOOZE (5M)
        </button>
        <div className={styles.snoozeProgress}>
          <div 
            className={styles.bar} 
            style={{ width: `${(snoozeHold / 5000) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default AlarmOverlay;
