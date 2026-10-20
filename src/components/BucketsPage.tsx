import { type FC, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ArrowLeft, Plus, StickyNote } from 'lucide-react';
import styles from './BucketsPage.module.scss';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine } from '../utils/audio';
import {
  type Viewport,
  VIEWPORT_STORAGE_KEY,
  loadViewport,
  saveViewport,
  recenter,
  screenToWorld,
  wheelZoomFactor,
  zoomAt,
  isTypingTarget,
  stackingOrder,
  snapToGrid,
} from '../utils/canvas';
import { BucketPanel } from './BucketPanel';
import { ObjectiveDetails } from './ObjectiveDetails';
import { CategoryManagerModal } from './CategoryManagerModal';
import { CanvasNoteView } from './CanvasNoteView';
import { useCanvasNotes } from '../hooks/useCanvasNotes';
import type { StrategicObjective } from '../types';

const BUCKET_COLORS = ['#3388ff', '#ff8844', '#44cc88', '#cc44cc', '#ffcc33', '#33cccc'];
const DEFAULT_BUCKET_W = 300;
const DEFAULT_BUCKET_H = 420;
const GRID_SIZE = 24;
const SAVE_DELAY_MS = 300;
const DEFAULT_NOTE_COLOR = '#ffcc33';
const DEFAULT_NOTE_W = 260;
const DEFAULT_NOTE_H = 200;
// Screen px between a new note and the top/right edges of the viewport
const NEW_NOTE_MARGIN_PX = 24;
// Every note sits above every bucket panel (buckets use z-index 1..N)
const NOTE_Z_BASE = 10000;  // keep above BucketPanel's DRAGGING_Z_INDEX (9999)

interface DragData {
  objectiveId: number;
  containerId: string;
}

const bucketIdOf = (containerId: string): number => Number(containerId.slice('bucket-'.length));

// Pointer hit first (cards and panel bodies); fall back to the nearest target
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : closestCenter(args);
};

interface BucketsPageProps {
  onBack: () => void;
}

export const BucketsPage: FC<BucketsPageProps> = ({ onBack }) => {
  const {
    buckets,
    objectivePool,
    objectivesByBucket,
    missionObjectives,
    categories,
    setViewedObjective,
    setObjectiveMission,
    moveObjectiveToBucket,
    reorderBucketObjectives,
    reorderObjectives,
    addBucket,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,
  } = useFocus();
  const { notes, addNote, duplicateNote, updateContent, updateColor, updateGeometry, bringToFront, deleteNote } = useCanvasNotes();
  // At most one note is edited at a time
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);

  const [vp, setVp] = useState<Viewport>(loadViewport);
  const vpRef = useRef(vp);
  const viewportRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [dragged, setDragged] = useState<StrategicObjective | null>(null);
  const isDraggingRef = useRef(false);
  // Read before any effect runs: StrictMode's simulated unmount saves the viewport, which
  // would make a re-run effect think this isn't the first visit
  const [isFirstVisit] = useState(() => localStorage.getItem(VIEWPORT_STORAGE_KEY) === null);

  const getRect = () => viewportRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 0, height: 0 };

  // First visit (nothing stored): put the origin in the middle once layout is known
  useEffect(() => {
    if (!isFirstVisit) return;
    const frame = requestAnimationFrame(() => {
      const rect = getRect();
      setVp(v => recenter(v, rect.width, rect.height));
    });
    return () => cancelAnimationFrame(frame);
  }, [isFirstVisit]);

  // Debounced persistence, plus a final save on unmount
  useEffect(() => {
    vpRef.current = vp;
    const timer = setTimeout(() => saveViewport(vp), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [vp]);

  useEffect(() => () => saveViewport(vpRef.current), []);

  // Native listener: React's onWheel is passive and can't preventDefault
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      // Let scrollable panel lists and the details drawer scroll; Ctrl+wheel and Shift+wheel always zoom
      if (!e.ctrlKey && !e.shiftKey && (e.target as Element).closest?.('[data-canvas-scroll]')) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      // Chromium turns Shift+wheel into a horizontal scroll (deltaX); zoom by whichever axis moved
      const delta = e.shiftKey && e.deltaY === 0 ? e.deltaX : e.deltaY;
      const factor = wheelZoomFactor(delta);
      setVp(v => zoomAt(v, sx, sy, factor));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const closeDetails = useCallback(() => setDetailsOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === ' ') {
        e.preventDefault();
        const rect = getRect();
        setVp(v => recenter(v, rect.width, rect.height));
      } else if (e.key === 'Escape') {
        // dnd-kit cancels an active drag on Escape; don't also leave the page
        if (isDraggingRef.current) return;
        if (showCategoryManager) {
          setShowCategoryManager(false);
        } else if (detailsOpen) {
          setDetailsOpen(false);
        } else {
          onBack();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detailsOpen, showCategoryManager, onBack]);

  const startPan = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    panRef.current = { startX: e.clientX, startY: e.clientY, panX: vp.panX, panY: vp.panY };
    setIsPanning(true);
  };

  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const isBackground = e.target === e.currentTarget || (e.target as HTMLElement).dataset.testid === 'canvas-world';
    if (!(isBackground && e.button === 0) && e.button !== 1) return;
    startPan(e);
  };

  // Shift held *before* the press pans the canvas from anywhere (cards, panels, notes) and stops the press
  // from starting their own drag. Capture phase, so it runs before those handlers. Real controls, text boxes,
  // the details drawer and portalled dialogs (React events bubble out of portals, the DOM check filters them) keep
  // their normal behaviour. Shift pressed *during* a panel/note drag still means "move freely, no snapping".
  const handleViewportPointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.shiftKey || e.button !== 0) return;
    const target = e.target as Element;
    if (!e.currentTarget.contains(target)) return;
    if (isTypingTarget(target) || target.closest('button, a, input, select, textarea, label, [data-no-pan]')) return;
    e.stopPropagation();
    startPan(e);
  };

  const handleViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan) return;
    setVp(v => ({ ...v, panX: pan.panX + e.clientX - pan.startX, panY: pan.panY + e.clientY - pan.startY }));
  };

  const handleViewportPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!panRef.current) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    panRef.current = null;
    setIsPanning(false);
  };

  const handleRecenter = () => {
    soundEngine.playClick();
    const rect = getRect();
    setVp(v => recenter(v, rect.width, rect.height));
  };

  const handleNewBucket = () => {
    soundEngine.playClick();
    const rect = getRect();
    const center = screenToWorld(vp, rect.width / 2, rect.height / 2);
    addBucket('NEW_BUCKET', BUCKET_COLORS[buckets.length % BUCKET_COLORS.length], {
      x: Math.round(center.x - DEFAULT_BUCKET_W / 2),
      y: Math.round(center.y - DEFAULT_BUCKET_H / 2),
      w: DEFAULT_BUCKET_W,
      h: DEFAULT_BUCKET_H,
    });
  };

  const handleNewNote = async () => {
    soundEngine.playClick();
    const rect = getRect();
    const corner = screenToWorld(vp, rect.width - DEFAULT_NOTE_W * vp.zoom - NEW_NOTE_MARGIN_PX, NEW_NOTE_MARGIN_PX);
    const id = await addNote(DEFAULT_NOTE_COLOR, {
      x: snapToGrid(corner.x),
      y: snapToGrid(corner.y),
      w: DEFAULT_NOTE_W,
      h: DEFAULT_NOTE_H,
    });
    if (id !== null) setEditingNoteId(id);
  };

  const handleStartNoteEdit = useCallback((id: number) => setEditingNoteId(id), []);
  // Only clears if this note is still the one being edited (another may have opened since)
  const handleEndNoteEdit = useCallback((id: number) => setEditingNoteId(cur => (cur === id ? null : cur)), []);

  const handleOpenDetails = useCallback((id: number) => {
    setViewedObjective(id);
    setDetailsOpen(true);
  }, [setViewedObjective]);

  const handleManageCategories = useCallback(() => setShowCategoryManager(true), []);

  const objectiveCountByCategory = useMemo(() => {
    const map = new Map<number, number>();
    for (const obj of objectivePool) {
      if (obj.category_id != null) {
        map.set(obj.category_id, (map.get(obj.category_id) || 0) + 1);
      }
    }
    return map;
  }, [objectivePool]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = (event: DragStartEvent) => {
    isDraggingRef.current = true;
    const data = event.active.data.current as DragData | undefined;
    setDragged(data ? objectivePool.find(o => o.id === data.objectiveId) ?? null : null);
  };

  const handleDragCancel = () => {
    // Cleared after the Escape keydown has reached the window listener
    setTimeout(() => { isDraggingRef.current = false; }, 0);
    setDragged(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    isDraggingRef.current = false;
    setDragged(null);
    const { active, over } = event;
    const data = active.data.current as DragData | undefined;
    const to = over?.data.current?.containerId as string | undefined;
    if (!data || !over || !to) return;
    const { objectiveId, containerId: from } = data;
    const overObjectiveId = over.data.current?.objectiveId as number | undefined;

    if (to === 'mission') {
      if (from !== 'mission') {
        // Dropping on Mission adds it there; it stays in its bucket. Already in Mission: no-op
        // (the DB call would move it to the end of Mission).
        if (objectivePool.find(o => o.id === objectiveId)?.is_mission !== 1) {
          setObjectiveMission(objectiveId, true);
        }
        return;
      }
      if (overObjectiveId === undefined || overObjectiveId === objectiveId) return;
      const oldIndex = missionObjectives.findIndex(o => o.id === objectiveId);
      const newIndex = missionObjectives.findIndex(o => o.id === overObjectiveId);
      if (oldIndex === -1 || newIndex === -1) return;
      soundEngine.playReorder();
      reorderObjectives(arrayMove(missionObjectives, oldIndex, newIndex).map(o => o.id));
      return;
    }

    const toBucketId = bucketIdOf(to);
    if (from === 'mission') {
      const obj = objectivePool.find(o => o.id === objectiveId);
      if (obj?.bucket_id !== toBucketId) moveObjectiveToBucket(objectiveId, toBucketId);
      return;
    }

    const fromBucketId = bucketIdOf(from);
    if (fromBucketId !== toBucketId) {
      moveObjectiveToBucket(objectiveId, toBucketId);
      return;
    }

    if (overObjectiveId === undefined || overObjectiveId === objectiveId) return;
    const list = objectivesByBucket.get(fromBucketId) ?? [];
    const oldIndex = list.findIndex(o => o.id === objectiveId);
    const newIndex = list.findIndex(o => o.id === overObjectiveId);
    if (oldIndex === -1 || newIndex === -1) return;
    soundEngine.playReorder();
    reorderBucketObjectives(fromBucketId, arrayMove(list, oldIndex, newIndex).map(o => o.id));
  };

  const gridSize = GRID_SIZE * vp.zoom;
  const stackOrder = useMemo(() => stackingOrder(buckets), [buckets]);
  const noteStackOrder = useMemo(() => stackingOrder(notes), [notes]);

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <button className={styles.toolBtn} onClick={() => { soundEngine.playClick(); onBack(); }}>
          <ArrowLeft size={14} />
          <span>BACK_TO_HUD</span>
        </button>
        <h2 className={styles.title}>CANVAS</h2>
        <div className={styles.toolbarRight}>
          <button className={styles.toolBtn} onClick={handleNewBucket}>
            <Plus size={14} />
            <span>NEW_PANEL</span>
          </button>
          <button className={styles.toolBtn} onClick={handleNewNote}>
            <StickyNote size={14} />
            <span>NEW_NOTE</span>
          </button>
          <span className={styles.zoomReadout}>{Math.round(vp.zoom * 100)}%</span>
          <button className={styles.toolBtn} onClick={handleRecenter} title="Recenter (Space)">
            <span>⌖ ORIGIN</span>
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          ref={viewportRef}
          className={`${styles.viewport} ${isPanning ? styles.panning : ''}`}
          style={{
            backgroundPosition: `${vp.panX}px ${vp.panY}px`,
            backgroundSize: `${gridSize}px ${gridSize}px`,
          }}
          onPointerDownCapture={handleViewportPointerDownCapture}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handleViewportPointerMove}
          onPointerUp={handleViewportPointerUp}
          onPointerCancel={handleViewportPointerUp}
        >
          <div
            className={styles.world}
            data-testid="canvas-world"
            style={{ transform: `translate(${vp.panX}px, ${vp.panY}px) scale(${vp.zoom})` }}
          >
            <div className={styles.origin} />
            {buckets.map(bucket => (
              <BucketPanel
                key={bucket.id}
                bucket={bucket}
                objectives={bucket.kind === 'mission' ? missionObjectives : objectivesByBucket.get(bucket.id) ?? []}
                zoom={vp.zoom}
                zIndex={stackOrder.get(bucket.id) ?? 1}
                onOpenDetails={handleOpenDetails}
                onManageCategories={handleManageCategories}
              />
            ))}
            {notes.map(note => (
              <CanvasNoteView
                key={note.id}
                note={note}
                zoom={vp.zoom}
                zIndex={NOTE_Z_BASE + (noteStackOrder.get(note.id) ?? 1)}
                isEditing={editingNoteId === note.id}
                onStartEdit={handleStartNoteEdit}
                onEndEdit={handleEndNoteEdit}
                onContentChange={updateContent}
                onColorChange={updateColor}
                onGeometryChange={updateGeometry}
                onBringToFront={bringToFront}
                onDuplicate={duplicateNote}
                onDelete={deleteNote}
              />
            ))}
          </div>

          {detailsOpen && (
            <div className={styles.detailsDrawer} data-details-barrier data-canvas-scroll data-no-pan onPointerDown={e => e.stopPropagation()}>
              <ObjectiveDetails onClose={closeDetails} />
            </div>
          )}
        </div>

        {/* Outside the scaled world; scaled by hand so it matches the cards */}
        <DragOverlay>
          {dragged && (
            <div className={styles.dragOverlay} style={{ width: `${100 / vp.zoom}%`, transform: `scale(${vp.zoom})`, transformOrigin: '0 0' }}>
              {dragged.text}
            </div>
          )}
        </DragOverlay>
      </DndContext>

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
    </div>
  );
};
