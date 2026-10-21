import { type FC, useCallback, useState, useRef, useEffect, useMemo } from 'react';
import styles from './SidebarLeft.module.scss';
import { Check, Crosshair, LayoutGrid, MinusCircle, CopyPlus, Copy, BookmarkPlus, Pencil, Trash2 } from 'lucide-react';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine, playStartSound } from '../utils/audio';
import { setStatusHint, clearStatusHint } from '../utils/statusHint';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import type { StrategicObjective, ObjectiveCategory, Bucket } from '../types';
import { copyPlain } from '../utils/clipboard';
import { readableOn } from '../utils/color';
import { isHoldingBucket } from '../utils/buckets';
import { firstValidBucketId, firstValidCategoryId, loadLastPicks, saveLastPicks } from '../utils/lastPicks';
import { ContextMenu } from './ContextMenu';
import { moveToBucketItem } from './bucketMoveItem';
import { SaveTemplateModal } from './SaveTemplateModal';
import { TemplateButtons } from './TemplateButtons';
import { BucketSelect } from './BucketSelect';
import { CategoryDotPicker } from './CategoryDotPicker';
import { DeadlineBadge } from './DeadlineBadge';
import { CategoryManagerModal } from './CategoryManagerModal';
import { AlarmsModal } from './AlarmsModal';

interface SortableItemProps {
  obj: StrategicObjective;
  isActive: boolean;
  isViewed: boolean;
  categories: ObjectiveCategory[];
  onSelect: (id: number) => void;
  onActivate: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, text: string) => void;
  onCategoryChange: (id: number, categoryId: number | null) => void;
  onManageCategories: () => void;
  onHover: () => void;
  onRemoveFromMission: (id: number) => void;
  onDuplicate: (id: number) => void;
  holdingBuckets: Bucket[]; // the buckets a task can be moved to
  onMoveToBucket: (id: number, bucketId: number) => void;
  bucket?: Bucket; // the objective's bucket, shown as a colored left stripe
}

const SortableItem: FC<SortableItemProps> = ({ obj, isActive, isViewed, categories, onSelect, onActivate, onDelete, onUpdate, onCategoryChange, onManageCategories, onHover, onRemoveFromMission, onDuplicate, holdingBuckets, onMoveToBucket, bucket }) => {
  const [isEditing, setIsEditing] = useState(false);
  // The whole row is the drag source; disabled while renaming so the input's text can be selected
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: obj.id, disabled: isEditing });
  const [editText, setEditText] = useState(obj.text);
  const [showPicker, setShowPicker] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const closeSaveTemplate = useCallback(() => setSavingTemplate(false), []);
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
    // The row carries its bucket's color: a 2px border all around (always) and a dark shade as background
    borderColor: bucket?.color,
    ...(bucket ? { background: `color-mix(in srgb, ${bucket.color} 22%, var(--bg-dark))` } : {}),
  };

  const startRename = () => {
    soundEngine.playEditStart();
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

  const handleClick = () => {
    if (isEditing) return;
    onSelect(obj.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isEditing) return; // keep the native menu (paste, etc.) in the rename box
    e.preventDefault();
    soundEngine.playClick();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isEditing) return;
    e.stopPropagation();
    onActivate(obj.id);
  };

  useEffect(() => {
    if (!isViewed) return;
    const handleF2 = (e: KeyboardEvent) => {
      if (e.key === 'F2' && !isEditing) {
        e.preventDefault();
        soundEngine.playEditStart();
        setIsEditing(true);
      }
    };
    window.addEventListener('keydown', handleF2);
    return () => window.removeEventListener('keydown', handleF2);
  }, [isViewed, isEditing]);

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
      className={`${styles.objectiveItem} ${isActive ? styles.activeObjective : ''} ${isViewed ? styles.viewedObjective : ''} ${decayClass}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={onHover}
      title={bucket ? `Bucket: ${bucket.name}` : undefined}
      data-bucket-id={bucket?.id}
      {...listeners}
      onContextMenu={handleContextMenu}
    >
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
            onManage={() => { setShowPicker(false); onManageCategories(); }}
            onClose={() => setShowPicker(false)}
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
        <div className={styles.objectiveText}>
          <span className={styles.objectiveTextContent}>{obj.text}</span>
        </div>
      )}

      {obj.deadline_at && <DeadlineBadge deadline={obj.deadline_at} className={styles.deadline} />}

      {/* Always rendered: CSS opens it (width transition) while the row is active */}
      <div
        className={styles.activeTab}
        style={{ backgroundColor: bucket?.color ?? 'var(--primary)', color: bucket ? readableOn(bucket.color) : '#111111' }}
        aria-hidden={!isActive}
        data-testid="active-tab"
      >
        <div className={styles.activeTabInner} role={isActive ? 'img' : undefined} aria-label={isActive ? 'Active objective' : undefined}>
          <Crosshair size={24} className={styles.activeRing} />
          <span className={styles.activeDot} />
        </div>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
          items={[
            { label: 'Rename', icon: <Pencil size={12} />, onSelect: startRename },
            moveToBucketItem(holdingBuckets, obj.bucket_id, bucketId => onMoveToBucket(obj.id, bucketId)),
            { label: 'Remove from Mission', icon: <MinusCircle size={12} />, onSelect: () => onRemoveFromMission(obj.id) },
            { label: 'Duplicate', icon: <CopyPlus size={12} />, onSelect: () => onDuplicate(obj.id) },
            { label: 'Copy text', icon: <Copy size={12} />, onSelect: () => { void copyPlain(obj.text); } },
            { label: 'Create template from task', icon: <BookmarkPlus size={12} />, onSelect: () => setSavingTemplate(true) },
            { label: 'Delete', icon: <Trash2 size={12} />, onSelect: () => onDelete(obj.id) },
          ]}
        />
      )}
      {savingTemplate && <SaveTemplateModal task={obj} onClose={closeSaveTemplate} />}
    </div>
  );
};

interface SidebarLeftProps {
  onOpenDetails: () => void;
  onViewBuckets: () => void;
}

export const SidebarLeft: FC<SidebarLeftProps> = ({ onOpenDetails, onViewBuckets }) => {
  const {
    objectivePool,
    missionObjectives,
    activeObjectiveId,
    viewedObjectiveId,
    addObjective,
    deleteObjective,
    duplicateObjective,
    moveObjectiveToBucket,
    updateObjective,
    updateObjectiveCategory,
    setActiveObjective,
    setViewedObjective,
    reorderObjectives,
    setObjectiveMission,
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
    buckets,
  } = useFocus();
  const bucketById = useMemo(() => new Map(buckets.map(b => [b.id, b])), [buckets]);
  const [newObjective, setNewObjective] = useState('');
  // undefined = not picked this session: fall back to the last pick remembered on this machine
  const [categoryChoice, setCategoryChoice] = useState<number | null | undefined>(undefined);
  const [bucketChoice, setBucketChoice] = useState<number | undefined>(undefined);
  const [showNewCategoryPicker, setShowNewCategoryPicker] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showAlarms, setShowAlarms] = useState(false);

  const displayedObjectives = missionObjectives;

  // A remembered pick that was deleted since falls back (first category / Unsorted)
  const newCategoryId = categoryChoice !== undefined
    ? firstValidCategoryId([categoryChoice], categories)
    : firstValidCategoryId([loadLastPicks().categoryId, categories[0]?.id], categories);
  const holdingBuckets = useMemo(() => buckets.filter(isHoldingBucket), [buckets]);
  const newBucketId = firstValidBucketId([bucketChoice, loadLastPicks().bucketId], buckets);

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

  // Pointer only: the listeners sit on the whole row, so a keyboard sensor would start a drag on
  // Space/Enter from any focused button in it (Space is also the timer key). Shift+↑/↓ reorders instead.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
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
      await addObjective(newObjective.trim(), newCategoryId, prepend, { bucketId: newBucketId });
      saveLastPicks({ bucketId: newBucketId, categoryId: newCategoryId });
      setCategoryChoice(newCategoryId);
      if (newBucketId !== null) setBucketChoice(newBucketId);
      setNewObjective('');
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

  const handleDeleteObjective = (id: number) => {
    soundEngine.playClick();
    deleteObjective(id);
  };

  const handleUpdateObjective = (id: number, text: string) => {
    updateObjective(id, text);
  };

  const handleRemoveFromMission = (id: number) => {
    soundEngine.playClick();
    setObjectiveMission(id, false);
  };

  const handleMoveToBucket = (id: number, bucketId: number) => {
    soundEngine.playClick();
    void moveObjectiveToBucket(id, bucketId);
  };

  const handleDuplicate = (id: number) => {
    soundEngine.playClick();
    void duplicateObjective(id);
  };

  const handleSelectObjective = (id: number) => {
    soundEngine.playClick();
    setViewedObjective(id);
    onOpenDetails();
  };

  const handleActivateObjective = (id: number) => {
    if (id === activeObjectiveId) {
      soundEngine.playClick();
      setActiveObjective(null);
    } else {
      playStartSound();
      setActiveObjective(id);
    }
  };

  // Arrow key shortcuts: Up/Down select adjacent; Shift+Up/Down/Home/End reorder
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const isArrowUD = e.key === 'ArrowUp' || e.key === 'ArrowDown';

      // 1. Task Selection (Works with Up/Down)
      if (isArrowUD && !e.shiftKey) {
        e.preventDefault();
        if (displayedObjectives.length === 0) return;
        const idx = displayedObjectives.findIndex(o => o.id === viewedObjectiveId);
        let nextIdx: number;
        if (idx === -1) {
          nextIdx = e.key === 'ArrowDown' ? 0 : displayedObjectives.length - 1;
        } else {
          nextIdx = e.key === 'ArrowUp' ? Math.max(0, idx - 1) : Math.min(displayedObjectives.length - 1, idx + 1);
        }
        if (nextIdx !== idx) {
          setViewedObjective(displayedObjectives[nextIdx].id);
          soundEngine.playNavSelect();
        }
        return;
      }

      // 2. Shift Actions (Reorder)
      if (e.shiftKey && viewedObjectiveId !== null) {
        const idx = displayedObjectives.findIndex(o => o.id === viewedObjectiveId);

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
  }, [viewedObjectiveId, displayedObjectives, reorderObjectives, setViewedObjective]);

  return (
    <aside className={styles.sidebar} data-details-barrier>
      <div className="card">
        <div className={styles.viewToggle}>
          <h4 className={styles.sectionTitle}>MISSION_OBJECTIVES</h4>
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
                  setCategoryChoice(catId);
                  setShowNewCategoryPicker(false);
                }}
                onManage={() => { setShowNewCategoryPicker(false); setShowCategoryManager(true); }}
                onClose={() => setShowNewCategoryPicker(false)}
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
            <BucketSelect
              className={styles.bucketSelect}
              buckets={holdingBuckets}
              value={newBucketId}
              onChange={setBucketChoice}
              onMouseEnter={() => setStatusHint('SET_BUCKET')}
              onMouseLeave={clearStatusHint}
              ariaLabel="Bucket for new objective"
              title="Bucket for the new objective"
            />
          </div>
        </form>

        <TemplateButtons className={styles.templates} />

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <SortableContext items={displayedObjectives.map(o => o.id)} strategy={verticalListSortingStrategy}>
              <div className={styles.objectiveList}>
                {displayedObjectives.map((obj) => (
                  <SortableItem
                    key={obj.id}
                    obj={obj}
                    isActive={activeObjectiveId === obj.id}
                    isViewed={viewedObjectiveId === obj.id}
                    categories={categories}
                    onSelect={handleSelectObjective}
                    onActivate={handleActivateObjective}
                    onDelete={handleDeleteObjective}
                    onUpdate={handleUpdateObjective}
                    onCategoryChange={handleObjectiveCategoryChange}
                    onManageCategories={() => setShowCategoryManager(true)}
                    onHover={handleHover}
                    onRemoveFromMission={handleRemoveFromMission}
                    onDuplicate={handleDuplicate}
                    holdingBuckets={holdingBuckets}
                    onMoveToBucket={handleMoveToBucket}
                    bucket={bucketById.get(obj.bucket_id ?? -1)}
                  />
                ))}
                {displayedObjectives.length === 0 && (
                  <div className={styles.emptyPool}>NO_ACTIVE_OBJECTIVES</div>
                )}
              </div>
            </SortableContext>
          </div>
        </DndContext>

        <button
          className={styles.canvasBtn}
          onClick={() => { soundEngine.playClick(); onViewBuckets(); }}
          onMouseEnter={() => { handleHover(); setStatusHint('OPEN_CANVAS'); }}
          onMouseLeave={clearStatusHint}
          title="Canvas (B)"
        >
          <LayoutGrid size={20} />
          <span>CANVAS</span>
        </button>
      </div>

      {showAlarms && (
        <AlarmsModal
          onClose={() => setShowAlarms(false)}
        />
      )}
      {showCategoryManager && (
        <CategoryManagerModal
          categories={categories}
          onAdd={addCategory}
          onUpdate={updateCategory}
          onDelete={deleteCategory}
          onReorder={reorderCategories}
          onClose={() => setShowCategoryManager(false)}
          objectiveCountByCategory={objectiveCountByCategory}
        />
      )}
    </aside>
  );
};
