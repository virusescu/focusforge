import { type FC, useCallback, useState } from 'react';
import styles from './SidebarLeft.module.scss';
import { User, Database, Cpu, HardDrive, BarChart2, Plus, X, Target, GripVertical } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine } from '../utils/audio';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import type { StrategicObjective } from '../types';

interface SortableItemProps {
  obj: StrategicObjective;
  isActive: boolean;
  onSelect: (id: number) => void;
  onDelete: (e: React.MouseEvent, id: number) => void;
  onHover: () => void;
}

const SortableItem: FC<SortableItemProps> = ({ obj, isActive, onSelect, onDelete, onHover }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: obj.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.objectiveItem} ${isActive ? styles.activeObjective : ''}`}
      onClick={() => onSelect(obj.id)}
      onMouseEnter={onHover}
    >
      <button
        className={styles.dragHandle}
        {...attributes}
        {...listeners}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        <GripVertical size={12} />
      </button>
      <div className={styles.objectiveText}>
        {isActive && <Target size={12} className={styles.targetIcon} />}
        <span>{obj.text}</span>
      </div>
      <button
        className={styles.deleteBtn}
        onClick={(e) => onDelete(e, obj.id)}
        onMouseEnter={onHover}
      >
        <X size={12} />
      </button>
    </div>
  );
};

interface Props {
  onViewAnalytics?: () => void;
}

export const SidebarLeft: FC<Props> = ({ onViewAnalytics }) => {
  const { user, avatar, loading } = useUser();
  const { objectivePool, activeObjectiveId, addObjective, deleteObjective, setActiveObjective, reorderObjectives } = useFocus();
  const [newObjective, setNewObjective] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = objectivePool.findIndex(o => o.id === active.id);
    const newIndex = objectivePool.findIndex(o => o.id === over.id);
    const newOrder = arrayMove(objectivePool, oldIndex, newIndex);
    reorderObjectives(newOrder.map(o => o.id));
  }, [objectivePool, reorderObjectives]);

  const handleAnalyticsClick = useCallback(() => {
    soundEngine.playClick();
    onViewAnalytics?.();
  }, [onViewAnalytics]);

  const handleHover = () => {
    soundEngine.playHover();
  };

  const handleAddObjective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newObjective.trim()) {
      soundEngine.playClick();
      await addObjective(newObjective.trim());
      setNewObjective('');
    }
  };

  const handleDeleteObjective = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    soundEngine.playClick();
    deleteObjective(id);
  };

  const handleSelectObjective = (id: number) => {
    soundEngine.playClick();
    setActiveObjective(id === activeObjectiveId ? null : id);
  };

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

        {onViewAnalytics && (
          <button 
            className={styles.analyticsBtn} 
            onClick={handleAnalyticsClick}
            onMouseEnter={handleHover}
          >
            <BarChart2 size={14} />
            <span>SYSTEM_ANALYTICS</span>
          </button>
        )}
      </div>

      <div className="card">
        <h4 className={styles.sectionTitle}>MISSION_OBJECTIVES</h4>
        <form className={styles.objectiveInputContainer} onSubmit={handleAddObjective}>
          <input
            type="text"
            className={styles.objectiveInput}
            placeholder="Add Objective..."
            value={newObjective}
            onChange={(e) => setNewObjective(e.target.value)}
            onMouseEnter={handleHover}
          />
          <button type="submit" className={styles.addBtn} onMouseEnter={handleHover}>
            <Plus size={14} />
          </button>
        </form>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
          <SortableContext items={objectivePool.map(o => o.id)} strategy={verticalListSortingStrategy}>
            <div className={styles.objectiveList}>
              {objectivePool.map((obj) => (
                <SortableItem
                  key={obj.id}
                  obj={obj}
                  isActive={activeObjectiveId === obj.id}
                  onSelect={handleSelectObjective}
                  onDelete={handleDeleteObjective}
                  onHover={handleHover}
                />
              ))}
              {objectivePool.length === 0 && (
                <div className={styles.emptyPool}>NO_ACTIVE_OBJECTIVES</div>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>
      
    </aside>
  );
};
