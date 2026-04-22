import React, { useState, useRef, useEffect } from 'react';
import styles from './AlarmsModal.module.scss';
import { useAlarms } from '../contexts/AlarmContext';
import { soundEngine } from '../utils/audio';
import type { Alarm } from '../types';
import { Edit2, Trash2, X, Check, Plus } from 'lucide-react';

interface AlarmsModalProps {
  onClose: () => void;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const TimePicker: React.FC<{ value: string; onChange: (val: string) => void }> = ({ value, onChange }) => {
  const [h, m] = value.split(':').map(Number);
  const dragData = useRef<{ startY: number; startVal: number; type: 'h' | 'm'; otherVal: number } | null>(null);

  const adjustHour = (delta: number) => {
    let next = h + delta;
    while (next > 23) next -= 24;
    while (next < 0) next += 24;
    onChange(`${String(next).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  const adjustMin = (delta: number) => {
    let next = m + delta;
    while (next > 59) next -= 60;
    while (next < 0) next += 60;
    onChange(`${String(h).padStart(2, '0')}:${String(next).padStart(2, '0')}`);
  };

  const onPointerDown = (e: React.PointerEvent, type: 'h' | 'm') => {
    // Only drag with left mouse button
    if (e.button !== 0) return;
    
    dragData.current = {
      startY: e.clientY,
      startVal: type === 'h' ? h : m,
      type,
      otherVal: type === 'h' ? m : h
    };
    
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragData.current) return;
    
    const { startY, startVal, type, otherVal } = dragData.current;
    const delta = Math.round((startY - e.clientY) / 10);
    
    if (type === 'h') {
      let next = startVal + delta;
      while (next > 23) next -= 24;
      while (next < 0) next += 24;
      onChange(`${String(next).padStart(2, '0')}:${String(otherVal).padStart(2, '0')}`);
    } else {
      let next = startVal + delta;
      while (next > 59) next -= 60;
      while (next < 0) next += 60;
      onChange(`${String(otherVal).padStart(2, '0')}:${String(next).padStart(2, '0')}`);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragData.current) return;
    dragData.current = null;
    const target = e.currentTarget as HTMLElement;
    target.releasePointerCapture(e.pointerId);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'h' | 'm') => {
    const val = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
    if (type === 'h') {
      const clamped = Math.min(23, Math.max(0, val));
      onChange(`${String(clamped).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    } else {
      const clamped = Math.min(59, Math.max(0, val));
      onChange(`${String(h).padStart(2, '0')}:${String(clamped).padStart(2, '0')}`);
    }
  };

  return (
    <div className={styles.customTimePicker}>
      <div className={styles.wheel}>
        <button type="button" onClick={() => adjustHour(1)}>▲</button>
        <input 
          type="text"
          className={styles.bigNum} 
          value={String(h).padStart(2, '0')}
          onPointerDown={e => onPointerDown(e, 'h')}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onChange={e => handleInputChange(e, 'h')}
          maxLength={2}
        />
        <button type="button" onClick={() => adjustHour(-1)}>▼</button>
      </div>
      <div className={styles.sep}>:</div>
      <div className={styles.wheel}>
        <button type="button" onClick={() => adjustMin(1)}>▲</button>
        <input 
          type="text"
          className={styles.bigNum} 
          value={String(m).padStart(2, '0')}
          onPointerDown={e => onPointerDown(e, 'm')}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onChange={e => handleInputChange(e, 'm')}
          maxLength={2}
        />
        <button type="button" onClick={() => adjustMin(-1)}>▼</button>
      </div>
    </div>
  );
};

const Toggle: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => {
  return (
    <label className={styles.toggleSwitch}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={styles.toggleSlider}></span>
    </label>
  );
};

export const AlarmsModal: React.FC<AlarmsModalProps> = ({ onClose }) => {
  const { alarms, addAlarm, updateAlarm, toggleAlarm, deleteAlarm } = useAlarms();
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('08:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const isMouseDownOnOverlay = useRef(false);

  const startAdd = () => {
    setEditingId(null);
    setNewTitle('');
    
    // Default time: current time + 5m, rounded down to 5m increment
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    const targetMinutes = totalMinutes + 5;
    const roundedMinutes = targetMinutes - (targetMinutes % 5);
    
    const h = Math.floor(roundedMinutes / 60) % 24;
    const m = roundedMinutes % 60;
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    
    setNewTime(timeStr);
    setSelectedDays([1, 2, 3, 4, 5]);
    setShowForm(true);
    soundEngine.playClick();
  };

  const startEdit = (alarm: Alarm) => {
    setEditingId(alarm.id);
    setNewTitle(alarm.title);
    setNewTime(alarm.time);
    setSelectedDays(alarm.days_of_week);
    setShowForm(true);
    soundEngine.playClick();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowForm(false);
    setNewTitle('');
    setNewTime('08:00');
    setSelectedDays([1, 2, 3, 4, 5]);
    soundEngine.playClick();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showForm) {
          cancelEdit();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showForm, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || selectedDays.length === 0) return;

    if (editingId !== null) {
      await updateAlarm(editingId, newTitle, newTime, selectedDays);
    } else {
      await addAlarm(newTitle, newTime, selectedDays);
    }

    setShowForm(false);
    setNewTitle('');
    soundEngine.playObjectiveAdded();
  };

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      isMouseDownOnOverlay.current = true;
    }
  };

  const handleOverlayMouseUp = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && isMouseDownOnOverlay.current) {
      onClose();
    }
    isMouseDownOnOverlay.current = false;
  };

  return (
    <div 
      className={styles.modalOverlay} 
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
    >
      <div className={styles.modalContent} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>ALARM_SYSTEM</h2>
          <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>

        {!showForm ? (
          <>
            <div className={styles.alarmList}>
              {alarms.length === 0 && <div className={styles.empty}>NO_ACTIVE_ALARMS</div>}
              {alarms.map(alarm => (
                <div key={alarm.id} className={styles.alarmItem}>
                  <div className={styles.alarmInfo}>
                    <div className={styles.alarmTime}>{alarm.time}</div>
                    <div className={styles.alarmTitle}>{alarm.title}</div>
                    <div className={styles.alarmDaysCompact}>
                      {DAYS.map((d, i) => (
                        <span key={i} className={alarm.days_of_week.includes(i) ? styles.active : ''}>{d}</span>
                      ))}
                    </div>
                  </div>
                  <div className={styles.alarmActions}>
                    <Toggle 
                      checked={alarm.is_active} 
                      onChange={() => toggleAlarm(alarm.id, !alarm.is_active)} 
                    />
                    <button className={styles.actionBtn} onClick={() => startEdit(alarm)}>
                      <Edit2 size={14} />
                    </button>
                    <button className={styles.deleteBtn} onClick={() => deleteAlarm(alarm.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button className={styles.addNewBtn} onClick={startAdd}>
              <Plus size={16} /> ADD_NEW_ALARM
            </button>
          </>
        ) : (
          <form className={styles.addForm} onSubmit={handleSubmit}>
            <div className={styles.formTitle}>
              {editingId !== null ? 'EDIT_ALARM' : 'NEW_ALARM'}
            </div>
            
            <input 
              type="text" 
              placeholder="ALARM_TITLE" 
              value={newTitle} 
              onChange={e => setNewTitle(e.target.value)} 
              required
              className={styles.titleInput}
              autoFocus
            />

            <TimePicker value={newTime} onChange={setNewTime} />

            <div className={styles.daysRow}>
              {DAYS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  className={`${styles.dayBtn} ${selectedDays.includes(i) ? styles.active : ''}`}
                  onClick={() => toggleDay(i)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className={styles.formActions}>
              <button type="button" className={styles.cancelBtn} onClick={cancelEdit}>CANCEL</button>
              <button type="submit" className={styles.submitBtn}>
                {editingId !== null ? 'CONFIRM_CHANGES' : 'CREATE_ALARM'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AlarmsModal;
