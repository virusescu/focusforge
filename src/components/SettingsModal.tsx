import { type FC, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './SettingsModal.module.scss';
import { X, Check } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

interface Props {
  onClose: () => void;
}

export const SettingsModal: FC<Props> = ({ onClose }) => {
  const { user, updateSettings, loading } = useUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [debugSpeed, setDebugSpeed] = useState(1);
  const [experienceLvl, setExperienceLvl] = useState(42);

  const isDev = import.meta.env.DEV;

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setDebugSpeed(user.debug_speed || 1);
      setExperienceLvl(user.experience_lvl || 42);
    }
  }, [user]);

  const handleSave = useCallback(async () => {
    await updateSettings(name, email, debugSpeed, experienceLvl);
    onClose();
  }, [name, email, debugSpeed, experienceLvl, updateSettings, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, onClose]);

  if (loading) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>SYSTEM_SETTINGS</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.field}>
            <label>OPERATOR_NAME</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Enter name..."
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <label>OPERATOR_EMAIL (USED_FOR_GRAVATAR)</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="Enter email..."
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
            />
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
          <button className={styles.cancelBtn} onClick={onClose}>
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
