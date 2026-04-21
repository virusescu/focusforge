import { type FC, useCallback, useState, useRef, useEffect, useMemo } from 'react';
import styles from './SidebarLeft.module.scss';
import { User, Zap, Flame, Star, Plus, X, GripVertical, Edit3, Check } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useFocus } from '../contexts/FocusContext';
import { useGame } from '../contexts/GameContext';
import { soundEngine } from '../utils/audio';
import { setStatusHint, clearStatusHint } from '../utils/statusHint';
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
import type { StrategicObjective, ObjectiveCategory } from '../types';
import { CategoryDotPicker } from './CategoryDotPicker';
import { CategoryManagerModal } from './CategoryManagerModal';

interface SortableItemProps {
  obj: StrategicObjective;
  isActive: boolean;
  categories: ObjectiveCategory[];
  onSelect: (id: number) => void;
  onDelete: (e: React.MouseEvent, id: number) => void;
  onUpdate: (id: number, text: string) => void;
  onCategoryChange: (id: number, categoryId: number | null) => void;
  onManageCategories: () => void;
  onHover: () => void;
  onMove: (id: number) => void;
  objectiveView: 'mission' | 'backlog';
}

const SortableItem: FC<SortableItemProps> = ({ obj, isActive, categories, onSelect, onDelete, onUpdate, onCategoryChange, onManageCategories, onHover, onMove, objectiveView }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: obj.id });
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(obj.text);
  const [showPicker, setShowPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const category = categories.find(c => c.id === obj.category_id);
  const categoryColor = category?.color;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundEngine.playClick();
    setIsEditing(true);
  };

  const handleSave = (e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.stopPropagation();
    if (editText.trim() && editText !== obj.text) {
      onUpdate(obj.id, editText.trim());
    }
    setIsEditing(false);
    soundEngine.playClick();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditText(obj.text);
      setIsEditing(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isEditing) return;
    if (e.shiftKey) {
      e.preventDefault();
      onMove(obj.id);
    } else {
      onSelect(obj.id);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isEditing) return;
    e.stopPropagation();
    soundEngine.playEditStart();
    setIsEditing(true);
  };

  const decayLevel = useMemo(() => {
    const lastDate = new Date(obj.last_interacted_at || obj.created_at);
    // Use a fixed timestamp for the calculation to satisfy React purity rules.
    // This value won't update automatically during a long session, but it will 
    // be refreshed whenever the component re-renders (e.g. on focus/interaction).
    const diffDays = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 7) return 2; // Decayed
    if (diffDays > 3) return 1; // Stale
    return 0; // Fresh
  }, [obj.last_interacted_at, obj.created_at]);

  const decayClass = decayLevel === 2 ? styles.decayed : decayLevel === 1 ? styles.stale : '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.objectiveItem} ${isActive ? styles.activeObjective : ''} ${decayClass}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
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

      <span
        className={styles.categoryBullet}
        style={{ backgroundColor: categoryColor || '#333333' }}
        onClick={(e) => { e.stopPropagation(); setShowPicker(prev => !prev); }}
        onMouseEnter={() => setStatusHint('SET_CATEGORY')}
        onMouseLeave={clearStatusHint}
      />

      {showPicker && (
        <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
          <CategoryDotPicker
            categories={categories}
            selectedCategoryId={obj.category_id ?? null}
            onSelect={(catId) => {
              onCategoryChange(obj.id, catId);
              setShowPicker(false);
            }}
            onManage={onManageCategories}
          />
        </div>
      )}

      {isEditing ? (
        <div className={styles.objectiveText} onClick={e => e.stopPropagation()}>
          <input
            ref={inputRef}
            className={styles.editInput}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => handleSave()}
          />
          <button className={styles.saveBtn} onClick={handleSave}>
            <Check size={12} />
          </button>
        </div>
      ) : (
        <>
          <div className={styles.objectiveText}>
            <span className={styles.objectiveTextContent}>{obj.text}</span>
          </div>
          <button
            className={styles.editBtn}
            onClick={handleEdit}
            onMouseEnter={() => { onHover(); setStatusHint('EDIT_OBJECTIVE'); }}
            onMouseLeave={clearStatusHint}
          >
            <Edit3 size={12} />
          </button>
        </>
      )}

      <button
        className={styles.moveBtn}
        onClick={(e) => { e.stopPropagation(); onMove(obj.id); }}
        onMouseEnter={() => { onHover(); setStatusHint(objectiveView === 'mission' ? 'MOVE_TO_BACKLOG' : 'MOVE_TO_MISSION'); }}
        onMouseLeave={clearStatusHint}
        title={objectiveView === 'mission' ? 'Move to Backlog' : 'Move to Mission'}
      >
        {objectiveView === 'mission' ? '→' : '←'}
      </button>

      <button
        className={styles.deleteBtn}
        onClick={(e) => onDelete(e, obj.id)}
        onMouseEnter={() => { onHover(); setStatusHint('DELETE_OBJECTIVE'); }}
        onMouseLeave={clearStatusHint}
      >
        <X size={12} />
      </button>
    </div>
  );
};

interface SidebarLeftProps {
  onOpenSettings: () => void;
}

export const SidebarLeft: FC<SidebarLeftProps> = ({ onOpenSettings }) => {
  const { name, avatar, loading } = useUser();
  const {
    objectivePool,
    missionObjectives,
    backlogObjectives,
    objectiveView,
    switchObjectiveView,
    activeObjectiveId,
    addObjective,
    deleteObjective,
    updateObjective,
    updateObjectiveCategory,
    setActiveObjective,
    reorderObjectives,
    moveObjectiveToOtherList,
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useFocus();
  const { sessionsToday, dailyBonusActive, currentStreakDays, streakMultiplier, totalCoinsEarned, prestigeTitles, currentTitle } = useGame();
  const [newObjective, setNewObjective] = useState('');
  const [newCategoryId, setNewCategoryId] = useState<number | null>(null);
  const [showNewCategoryPicker, setShowNewCategoryPicker] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const displayedObjectives = objectiveView === 'mission' ? missionObjectives : backlogObjectives;

  // Compute current prestige level progress (from current threshold to next threshold)
  const nextTitle = currentTitle
    ? prestigeTitles.find(t => t.unlock_threshold > currentTitle.unlock_threshold)
    : prestigeTitles[0];
  const levelFrom = currentTitle?.unlock_threshold ?? 0;
  const levelTo = nextTitle?.unlock_threshold ?? 60000;
  const levelProgress = Math.min(Math.max((totalCoinsEarned - levelFrom) / (levelTo - levelFrom), 0), 1);

  // Default newCategoryId to the first available category
  useEffect(() => {
    if (newCategoryId === null && categories.length > 0) {
      setNewCategoryId(categories[0].id);
    }
  }, [categories, newCategoryId]);

  const newCategoryColor = categories.find(c => c.id === newCategoryId)?.color;

  const objectiveCountByCategory = useMemo(() => {
    const map = new Map<number, number>();
    for (const obj of objectivePool) {
      if (obj.category_id != null) {
        map.set(obj.category_id, (map.get(obj.category_id) || 0) + 1);
      }
    }
    return map;
  }, [objectivePool]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = displayedObjectives.findIndex(o => o.id === active.id);
    const newIndex = displayedObjectives.findIndex(o => o.id === over.id);
    const newOrder = arrayMove(displayedObjectives, oldIndex, newIndex);
    reorderObjectives(newOrder.map(o => o.id));
  }, [displayedObjectives, reorderObjectives]);

  const handleHover = () => {
    soundEngine.playHover();
  };

  const handleAddObjective = async (e: React.FormEvent, prepend: boolean = false) => {
    e.preventDefault();
    if (newObjective.trim()) {
      soundEngine.playClick();
      await addObjective(newObjective.trim(), newCategoryId, prepend);
      setNewObjective('');
      setNewCategoryId(null);
      setShowNewCategoryPicker(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      handleAddObjective(e as unknown as React.FormEvent, true);
    }
    // Regular Enter falls through to form onSubmit
  };

  const handleObjectiveCategoryChange = (id: number, categoryId: number | null) => {
    updateObjectiveCategory(id, categoryId);
  };

  const handleDeleteObjective = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    soundEngine.playClick();
    deleteObjective(id);
  };

  const handleUpdateObjective = (id: number, text: string) => {
    updateObjective(id, text);
  };

  const handleSelectObjective = (id: number) => {
    soundEngine.playClick();
    setActiveObjective(id === activeObjectiveId ? null : id);
  };

  // Arrow key shortcuts: Left/Right switch view; Shift+Left/Right move task; Up/Down select adjacent; Shift+Up/Down reorder
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const isArrowLR = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      const isArrowUD = e.key === 'ArrowUp' || e.key === 'ArrowDown';

      // 1. View Switching (Works always with Left/Right)
      if (isArrowLR && !e.shiftKey) {
        const target = e.key === 'ArrowLeft' ? 'mission' : 'backlog';
        console.log('[SidebarLeft] Switching view to:', target);
        switchObjectiveView(target);
        return;
      }

      // 2. Task Selection (Works with Up/Down)
      if (isArrowUD && !e.shiftKey) {
        e.preventDefault();
        if (displayedObjectives.length === 0) return;
        const idx = displayedObjectives.findIndex(o => o.id === activeObjectiveId);
        let nextIdx: number;
        if (idx === -1) {
          nextIdx = e.key === 'ArrowDown' ? 0 : displayedObjectives.length - 1;
        } else {
          nextIdx = e.key === 'ArrowUp' ? Math.max(0, idx - 1) : Math.min(displayedObjectives.length - 1, idx + 1);
        }
        if (nextIdx !== idx) {
          setActiveObjective(displayedObjectives[nextIdx].id);
          soundEngine.playNavSelect();
        }
        return;
      }

      // 3. Shift Actions (Move or Reorder)
      if (e.shiftKey && activeObjectiveId !== null) {
        const idx = displayedObjectives.findIndex(o => o.id === activeObjectiveId);
        
        // Move Task between lists
        if (isArrowLR) {
          const isTaskInMission = missionObjectives.some(o => o.id === activeObjectiveId);
          const wantsToMoveToBacklog = e.key === 'ArrowRight' && isTaskInMission;
          const wantsToMoveToMission = e.key === 'ArrowLeft' && !isTaskInMission;
          
          if (wantsToMoveToBacklog || wantsToMoveToMission) {
            console.log('[SidebarLeft] Shortcut: Moving task', activeObjectiveId);
            e.preventDefault();
            moveObjectiveToOtherList(activeObjectiveId);
            soundEngine.playClick();
          }
          return;
        }

        // Reorder Task
        if (idx !== -1) {
          let newOrder: typeof displayedObjectives | null = null;
          if (e.key === 'ArrowUp' && idx > 0) {
            newOrder = arrayMove(displayedObjectives, idx, idx - 1);
          } else if (e.key === 'ArrowDown' && idx < displayedObjectives.length - 1) {
            newOrder = arrayMove(displayedObjectives, idx, idx + 1);
          } else if (e.key === 'Home' && idx > 0) {
            newOrder = arrayMove(displayedObjectives, idx, 0);
          } else if (e.key === 'End' && idx < displayedObjectives.length - 1) {
            newOrder = arrayMove(displayedObjectives, idx, displayedObjectives.length - 1);
          }
          
          if (newOrder) {
            e.preventDefault();
            soundEngine.playReorder();
            reorderObjectives(newOrder.map(o => o.id));
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [switchObjectiveView, activeObjectiveId, displayedObjectives, missionObjectives, reorderObjectives, setActiveObjective, moveObjectiveToOtherList]);

  if (loading) return <aside className={styles.sidebar} data-details-barrier>LOADING...</aside>;

  return (
    <aside className={styles.sidebar} data-details-barrier>
      <div className="card">
        <div
          className={styles.operatorCard}
          onClick={onOpenSettings}
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => setStatusHint('OPEN_SETTINGS')}
          onMouseLeave={clearStatusHint}
        >
          <div className={styles.avatar}>
            {avatar ? (
              <img src={avatar} alt="User Avatar" style={{ width: '100%', height: '100%', borderRadius: '4px' }} />
            ) : (
              <User size={32} />
            )}
          </div>
          <div className={styles.details}>
            <h3>{name || 'LOADING...'}</h3>
            <p>SYNC_STABLE</p>
          </div>
        </div>

        <div className={styles.stats}>
          <div className={styles.multiplierRow}>
            {(() => {
              const dailyMult = dailyBonusActive ? 2.0 : 1.0;
              const combined = streakMultiplier * dailyMult;
              const isBase = combined <= 1;
              return (
                <div className={`${styles.multiplierDisplay} ${isBase ? styles.multiplierInactive : ''}`}>
                  <span className={styles.multiplierValue}>{isBase ? '—' : `${combined.toFixed(2)}x`}</span>
                  <span className={styles.multiplierLabel}>MULTIPLIER</span>
                </div>
              );
            })()}
            <div className={styles.compactStats}>
              <div className={styles.compactItem}>
                <div className={styles.compactInfo}>
                  <Zap size={10} />
                  <span>DAILY</span>
                  <span className={styles.compactValue}>{dailyBonusActive ? '2x' : `${Math.min(sessionsToday, 3)}/3`}</span>
                </div>
                <div className={styles.progressBar}>
                  <div className={`${styles.progressFill} ${dailyBonusActive ? styles.progressActive : ''}`} style={{ width: `${Math.min(sessionsToday / 3, 1) * 100}%` }} />
                </div>
              </div>
              <div className={styles.compactItem}>
                <div className={styles.compactInfo}>
                  <Flame size={10} />
                  <span>STREAK</span>
                  <span className={styles.compactValue}>{currentStreakDays}/4</span>
                </div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${(currentStreakDays / 4) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div
            className={styles.statItem}
            title={`Total: ${Math.floor(totalCoinsEarned).toLocaleString()} / 60,000 ⟐`}
          >
            <div className={styles.statInfo}>
              <div className={styles.statLabel}>
                <Star size={12} />
                <span>FORGE_PROGRESS</span>
              </div>
              <span className={styles.statValue}>
                {nextTitle
                  ? `${Math.floor(totalCoinsEarned - levelFrom).toLocaleString()} / ${(levelTo - levelFrom).toLocaleString()}`
                  : 'MAX'}
              </span>
            </div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${levelProgress * 100}%` }} />
            </div>
          </div>
        </div>

      </div>

      <div className="card">
        <div className={styles.viewToggle}>
          <button
            className={styles.viewToggleArrow}
            onClick={() => switchObjectiveView('mission')}
            disabled={objectiveView === 'mission'}
            title="Mission Objectives"
          >
            ‹
          </button>
          <h4 className={styles.sectionTitle}>
            {objectiveView === 'mission' ? 'MISSION_OBJECTIVES' : 'BACKLOG'}
          </h4>
          <button
            className={styles.viewToggleArrow}
            onClick={() => switchObjectiveView('backlog')}
            disabled={objectiveView === 'backlog'}
            title="Backlog"
          >
            ›
          </button>
        </div>
        <form className={styles.objectiveInputContainer} onSubmit={handleAddObjective}>
          <div className={styles.inputRow}>
            <span
              className={styles.categoryBullet}
              style={{ backgroundColor: newCategoryColor || '#333333' }}
              onClick={() => setShowNewCategoryPicker(prev => !prev)}
              onMouseEnter={() => setStatusHint('SET_CATEGORY')}
              onMouseLeave={clearStatusHint}
            />
            {showNewCategoryPicker && (
              <CategoryDotPicker
                categories={categories}
                selectedCategoryId={newCategoryId}
                onSelect={(catId) => {
                  setNewCategoryId(catId);
                  setShowNewCategoryPicker(false);
                }}
                onManage={() => setShowCategoryManager(true)}
              />
            )}
            <input
              type="text"
              className={styles.objectiveInput}
              placeholder="Add Objective..."
              value={newObjective}
              onChange={(e) => setNewObjective(e.target.value)}
              onMouseEnter={handleHover}
              onKeyDown={handleInputKeyDown}
            />
            <button type="submit" className={styles.addBtn} onMouseEnter={handleHover}>
              <Plus size={14} />
            </button>
          </div>
        </form>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <SortableContext items={displayedObjectives.map(o => o.id)} strategy={verticalListSortingStrategy}>
              <div className={styles.objectiveList}>
                {displayedObjectives.map((obj) => (
                  <SortableItem
                    key={obj.id}
                    obj={obj}
                    isActive={activeObjectiveId === obj.id}
                    categories={categories}
                    onSelect={handleSelectObjective}
                    onDelete={handleDeleteObjective}
                    onUpdate={handleUpdateObjective}
                    onCategoryChange={handleObjectiveCategoryChange}
                    onManageCategories={() => setShowCategoryManager(true)}
                    onHover={handleHover}
                    onMove={moveObjectiveToOtherList}
                    objectiveView={objectiveView}
                  />
                ))}
                {displayedObjectives.length === 0 && (
                  <div className={styles.emptyPool}>
                    {objectiveView === 'mission' ? 'NO_ACTIVE_OBJECTIVES' : 'BACKLOG_EMPTY'}
                  </div>
                )}
              </div>
            </SortableContext>
          </div>
        </DndContext>
      </div>

      {showCategoryManager && (
        <CategoryManagerModal
          categories={categories}
          onAdd={addCategory}
          onUpdate={updateCategory}
          onDelete={deleteCategory}
          onClose={() => setShowCategoryManager(false)}
          objectiveCountByCategory={objectiveCountByCategory}
        />
      )}
    </aside>
  );
};
