import { type FC, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './SettingsModal.module.scss';
import { X, Check, LogOut } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../contexts/AuthContext';
import { soundEngine } from '../utils/audio';

interface Props {
  onClose: () => void;
}

export const SettingsModal: FC<Props> = ({ onClose }) => {
  const { user, name, email, avatar, updateSettings, loading } = useUser();
  const { logout } = useAuth();
  const [debugSpeed, setDebugSpeed] = useState(1);
  const [experienceLvl, setExperienceLvl] = useState(42);
  const [dayStartHour, setDayStartHour] = useState(8);
  const [dayEndHour, setDayEndHour] = useState(2);

  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (user) {
      setDebugSpeed(user.debug_speed || 1);
      setExperienceLvl(user.experience_lvl || 42);
      setDayStartHour(user.day_start_hour ?? 8);
      setDayEndHour(user.day_end_hour ?? 2);
    }
  }, [user]);

  const handleSave = useCallback(async () => {
    soundEngine.playClick();
    await updateSettings(debugSpeed, experienceLvl, dayStartHour, dayEndHour);
    onClose();
  }, [debugSpeed, experienceLvl, dayStartHour, dayEndHour, updateSettings, onClose]);

  const handleCancel = useCallback(() => {
    soundEngine.playClick();
    onClose();
  }, [onClose]);

  const handleLogout = useCallback(async () => {
    soundEngine.playClick();
    await logout();
  }, [logout]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Tab') {
        soundEngine.playTab();
      } else if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
        soundEngine.playKey();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleCancel]);

  if (loading) return null;

  return createPortal(
    <div className={styles.overlay} onClick={handleCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>SYSTEM_SETTINGS</h2>
          <button className={styles.closeBtn} onClick={handleCancel}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.field}>
            <label>OPERATOR_NAME</label>
            <input
              type="text"
              value={name}
              disabled
              style={{ opacity: 0.6 }}
            />
          </div>
          <div className={styles.field}>
            <label>OPERATOR_EMAIL</label>
            <input
              type="email"
              value={email}
              disabled
              style={{ opacity: 0.6 }}
            />
          </div>
          <div className={styles.field}>
            <label>EXPERIENCE_LVL</label>
            <input
              type="number"
              value={experienceLvl}
              onChange={e => setExperienceLvl(Number(e.target.value))}
              placeholder="Enter level..."
              min="1"
              autoFocus
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>DAY_START_HOUR (0-23)</label>
              <input
                type="number"
                value={dayStartHour}
                onChange={e => setDayStartHour(Number(e.target.value))}
                min="0"
                max="23"
              />
            </div>
            <div className={styles.field}>
              <label>DAY_END_HOUR (0-23)</label>
              <input
                type="number"
                value={dayEndHour}
                onChange={e => setDayEndHour(Number(e.target.value))}
                min="0"
                max="23"
              />
            </div>
          </div>

          {isDev && (
            <div className={styles.field}>
              <label>DEBUG_SPEED_MULTIPLIER (DEV_ONLY)</label>
              <input
                type="number"
                value={debugSpeed}
                onChange={e => setDebugSpeed(Number(e.target.value))}
                min="1"
                max="1000"
              />
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={handleLogout}>
            <LogOut size={16} />
            SIGN_OUT
          </button>
          <div style={{ flex: 1 }} />
          <button className={styles.cancelBtn} onClick={handleCancel}>
            CANCEL
          </button>
          <button className={styles.saveBtn} onClick={handleSave}>
            <Check size={16} />
            APPLY_CHANGES
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
