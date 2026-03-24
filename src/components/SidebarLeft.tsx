import { type FC } from 'react';
import styles from './SidebarLeft.module.scss';
import { User, Database, Cpu, HardDrive } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

export const SidebarLeft: FC = () => {
  const { user, avatar, loading } = useUser();

  if (loading) return <aside className={styles.sidebar}>LOADING...</aside>;

  return (
    <aside className={styles.sidebar}>
      <div className="card">
        <div className={styles.operatorCard}>
          <div className={styles.avatar}>
            {avatar ? (
              <img src={avatar} alt="User Avatar" style={{ width: '100%', height: '100%', borderRadius: '4px' }} />
            ) : (
              <User size={32} />
            )}
          </div>
          <div className={styles.details}>
            <h3>{user?.name || 'LOADING...'}</h3>
            <p>SYNC_STABLE</p>
          </div>
        </div>
        
        <div className={styles.stats}>
          <div className={styles.statItem}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>
                <Database size={12} />
                <span>EXPERIENCE_LVL</span>
              </div>
              <span className={styles.statValue}>{user?.experience_lvl || 42}</span>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${Math.min(user?.experience_lvl || 42, 100)}%` }} />
            </div>
          </div>
          
          <div className={styles.statItem}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>
                <Cpu size={12} />
                <span>MEMORY_LOAD</span>
              </div>
              <span className={styles.statValue}>68%</span>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: '68%' }} />
            </div>
          </div>
          
          <div className={styles.statItem}>
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>
                <HardDrive size={12} />
                <span>INVENTORY_CAP</span>
              </div>
              <span className={styles.statValue}>40/50</span>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: '80%' }} />
            </div>
          </div>
        </div>
      </div>
      
      <div className="card">
        <h4 className={styles.sectionTitle}>AUGMENTATIONS</h4>
        <div className={styles.augments}>
          <div className={styles.augmentItem}>FOCUS_LENS_V1</div>
          <div className={styles.augmentItem}>CHRONOS_CORE</div>
          <div className={styles.augmentItemMuted}>[SLOT_EMPTY]</div>
        </div>
      </div>
    </aside>
  );
};
