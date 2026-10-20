import { type FC, useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import styles from './SettingsModal.module.scss';
import { X, Check, LogOut, Volume2, BookmarkPlus, Tags } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useAuth } from '../contexts/AuthContext';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine, playObjectiveComplete } from '../utils/audio';
import { CategoryManagerModal } from './CategoryManagerModal';
import { TemplateManagerModal } from './TemplateManagerModal';

type Manager = 'templates' | 'categories' | null;

interface Props {
  onClose: () => void;
}

export const SettingsModal: FC<Props> = ({ onClose }) => {
  const { user, name, email, updateSettings, loading } = useUser();
  const { logout } = useAuth();
  const { objectivePool, categories, addCategory, updateCategory, deleteCategory, reorderCategories } = useFocus();
  const [manager, setManager] = useState<Manager>(null);
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

  // Settings' own Enter (apply) and Escape (cancel) stand down while a manager is open on top of it
  useEffect(() => {
    if (manager !== 'categories') return;
    // The category manager has no key handling of its own; Escape closes just it
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      setManager(null);
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [manager]);

  const objectiveCountByCategory = useMemo(() => {
    const counts = new Map<number, number>();
    for (const obj of objectivePool) {
      if (obj.category_id != null) counts.set(obj.category_id, (counts.get(obj.category_id) ?? 0) + 1);
    }
    return counts;
  }, [objectivePool]);

  const closeManager = useCallback(() => setManager(null), []);

  useEffect(() => {
    if (manager) return;
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
  }, [manager, handleSave, handleCancel]);

  if (loading) return null;

  return (
    <>
    {createPortal(
    <div className={styles.overlay} onClick={handleCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2>SYSTEM_SETTINGS</h2>
            <button
              className={styles.soundTestBtn}
              onClick={(e) => {
                e.stopPropagation();
                playObjectiveComplete();
              }}
              title="TEST_AUDIO"
            >
              <Volume2 size={14} />
            </button>
          </div>
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

          <div className={styles.field}>
            <label>MANAGE</label>
            <div className={styles.manageRow}>
              <button className={styles.manageBtn} onClick={() => { soundEngine.playClick(); setManager('templates'); }}>
                <BookmarkPlus size={14} />
                TEMPLATES
              </button>
              <button className={styles.manageBtn} onClick={() => { soundEngine.playClick(); setManager('categories'); }}>
                <Tags size={14} />
                CATEGORIES
              </button>
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
    )}
    {manager === 'templates' && <TemplateManagerModal onClose={closeManager} />}
    {/* Portalled after Settings so it stacks above it (same z-index, later in the DOM) */}
    {manager === 'categories' && createPortal(
      <CategoryManagerModal
        categories={categories}
        onAdd={addCategory}
        onUpdate={updateCategory}
        onDelete={deleteCategory}
        onReorder={reorderCategories}
        onClose={closeManager}
        objectiveCountByCategory={objectiveCountByCategory}
      />,
      document.body,
    )}
    </>
  );
};
