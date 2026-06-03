import React, { useState, useRef, useEffect } from 'react';
import styles from './AlarmsModal.module.scss';
import { useAlarms } from '../contexts/AlarmContext';
import { soundEngine } from '../utils/audio';
import type { Alarm } from '../types';
import { Edit2, Trash2, X, Plus } from 'lucide-react';

interface AlarmsModalProps {
  onClose: () => void;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const TimePicker: React.FC<{ value: string; onChange: (val: string) => void }> = ({ value, onChange }) => {
  const [h, m] = value.split(':').map(Number);
  const [hInput, setHInput] = useState(String(h).padStart(2, '0'));
  const [mInput, setMInput] = useState(String(m).padStart(2, '0'));
  const dragData = useRef<{ startY: number; startVal: number; type: 'h' | 'm'; isDragging: boolean } | null>(null);

  useEffect(() => {
    const [ph, pm] = value.split(':').map(Number);
    if (ph !== parseInt(hInput)) setHInput(String(ph).padStart(2, '0'));
    if (pm !== parseInt(mInput)) setMInput(String(pm).padStart(2, '0'));
  }, [value]);

  const updateParent = (newH: number, newM: number) => {
    onChange(`${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
  };

  const adjustHour = (delta: number) => {
    let next = h + delta;
    while (next > 23) next -= 24;
    while (next < 0) next += 24;
    updateParent(next, m);
  };

  const adjustMin = (delta: number) => {
    let next = m + delta;
    while (next > 59) next -= 60;
    while (next < 0) next += 60;
    updateParent(h, next);
  };

  const onPointerDown = (e: React.PointerEvent, type: 'h' | 'm') => {
    if (e.button !== 0) return;
    dragData.current = {
      startY: e.clientY,
      startVal: type === 'h' ? h : m,
      type,
      isDragging: false
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragData.current) return;
    
    const { startY, startVal, type, isDragging } = dragData.current;
    const deltaY = startY - e.clientY;
    
    if (!isDragging && Math.abs(deltaY) < 5) return;
    
    if (!isDragging) {
      dragData.current.isDragging = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    
    const delta = Math.round(deltaY / 10);
    
    if (type === 'h') {
      let next = startVal + delta;
      while (next > 23) next -= 24;
      while (next < 0) next += 24;
      updateParent(next, m);
    } else {
      let next = startVal + delta;
      while (next > 59) next -= 60;
      while (next < 0) next += 60;
      updateParent(h, next);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragData.current) return;
    if (dragData.current.isDragging) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
    dragData.current = null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'h' | 'm') => {
    const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
    if (type === 'h') {
      setHInput(raw);
      const val = parseInt(raw);
      if (!isNaN(val)) updateParent(Math.min(23, val), m);
    } else {
      setMInput(raw);
      const val = parseInt(raw);
      if (!isNaN(val)) updateParent(h, Math.min(59, val));
    }
  };

  const onBlur = () => {
    setHInput(String(h).padStart(2, '0'));
    setMInput(String(m).padStart(2, '0'));
  };

  return (
    <div className={styles.customTimePicker}>
      <div className={styles.wheel}>
        <button type="button" onClick={() => adjustHour(1)}>▲</button>
        <input 
          type="text"
          className={styles.bigNum} 
          value={hInput}
          onPointerDown={e => onPointerDown(e, 'h')}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onChange={e => handleInputChange(e, 'h')}
          onBlur={onBlur}
        />
        <button type="button" onClick={() => adjustHour(-1)}>▼</button>
      </div>
      <div className={styles.sep}>:</div>
      <div className={styles.wheel}>
        <button type="button" onClick={() => adjustMin(1)}>▲</button>
        <input 
          type="text"
          className={styles.bigNum} 
          value={mInput}
          onPointerDown={e => onPointerDown(e, 'm')}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onChange={e => handleInputChange(e, 'm')}
          onBlur={onBlur}
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
