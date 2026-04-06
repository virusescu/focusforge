import { type FC, useCallback, useState, useRef, useEffect, useMemo } from 'react';
import styles from './SidebarLeft.module.scss';
import { User, Database, Cpu, HardDrive, BarChart2, Plus, X, GripVertical, Edit3, Check, Activity, Gem } from 'lucide-react';
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
}

const SortableItem: FC<SortableItemProps> = ({ obj, isActive, categories, onSelect, onDelete, onUpdate, onCategoryChange, onManageCategories, onHover }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: obj.id });
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(obj.text);
  const [showPicker, setShowPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const categoryColor = categories.find(c => c.id === obj.category_id)?.color;

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.objectiveItem} ${isActive ? styles.activeObjective : ''}`}
      onClick={() => !isEditing && onSelect(obj.id)}
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
        title="Set category"
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
            <span>{obj.text}</span>
          </div>
          <button
            className={styles.editBtn}
            onClick={handleEdit}
            onMouseEnter={onHover}
            title="Edit Objective"
          >
            <Edit3 size={12} />
          </button>
        </>
      )}

      <button
        className={styles.deleteBtn}
        onClick={(e) => onDelete(e, obj.id)}
        onMouseEnter={onHover}
        title="Delete Objective"
      >
        <X size={12} />
      </button>
    </div>
  );
};

interface Props {
  onViewAnalytics?: () => void;
  onViewIntel?: () => void;
  onViewVault?: () => void;
}

export const SidebarLeft: FC<Props> = ({ onViewAnalytics, onViewIntel, onViewVault }) => {
  const { user, name, avatar, loading } = useUser();
  const { objectivePool, activeObjectiveId, addObjective, deleteObjective, updateObjective, updateObjectiveCategory, setActiveObjective, reorderObjectives, categories, addCategory, updateCategory, deleteCategory } = useFocus();
  const [newObjective, setNewObjective] = useState('');
  const [newCategoryId, setNewCategoryId] = useState<number | null>(null);
  const [showNewCategoryPicker, setShowNewCategoryPicker] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

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
    const oldIndex = objectivePool.findIndex(o => o.id === active.id);
    const newIndex = objectivePool.findIndex(o => o.id === over.id);
    const newOrder = arrayMove(objectivePool, oldIndex, newIndex);
    reorderObjectives(newOrder.map(o => o.id));
  }, [objectivePool, reorderObjectives]);

  const handleAnalyticsClick = useCallback(() => {
    soundEngine.playClick();
    onViewAnalytics?.();
  }, [onViewAnalytics]);

  const handleIntelClick = useCallback(() => {
    soundEngine.playTab();
    onViewIntel?.();
  }, [onViewIntel]);

  const handleVaultClick = useCallback(() => {
    soundEngine.playClick();
    onViewVault?.();
  }, [onViewVault]);

  const handleHover = () => {
    soundEngine.playHover();
  };

  const handleAddObjective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newObjective.trim()) {
      soundEngine.playClick();
      await addObjective(newObjective.trim(), newCategoryId);
      setNewObjective('');
      setNewCategoryId(null);
      setShowNewCategoryPicker(false);
    }
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
            <h3>{name || 'LOADING...'}</h3>
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
        {onViewIntel && (
          <button
            className={styles.intelBtn}
            onClick={handleIntelClick}
            onMouseEnter={handleHover}
          >
            <Activity size={14} />
            <span>INTELLIGENCE_HUB</span>
          </button>
        )}
        {onViewVault && (
          <button
            className={styles.vaultBtn}
            onClick={handleVaultClick}
            onMouseEnter={handleHover}
          >
            <Gem size={14} />
            <span>FORGE_VAULT</span>
          </button>
        )}
      </div>

      <div className="card">
        <h4 className={styles.sectionTitle}>MISSION_OBJECTIVES</h4>
        <form className={styles.objectiveInputContainer} onSubmit={handleAddObjective}>
          <div className={styles.inputRow}>
            <span
              className={styles.categoryBullet}
              style={{ backgroundColor: newCategoryColor || '#333333' }}
              onClick={() => setShowNewCategoryPicker(prev => !prev)}
              title="Set category"
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
            />
            <button type="submit" className={styles.addBtn} onMouseEnter={handleHover}>
              <Plus size={14} />
            </button>
          </div>
        </form>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
          <SortableContext items={objectivePool.map(o => o.id)} strategy={verticalListSortingStrategy}>
            <div className={styles.objectiveList}>
              {objectivePool.map((obj) => (
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
                />
              ))}
              {objectivePool.length === 0 && (
                <div className={styles.emptyPool}>NO_ACTIVE_OBJECTIVES</div>
              )}
            </div>
          </SortableContext>
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
