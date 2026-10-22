import { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, BookmarkPlus, Copy, CopyPlus, MinusCircle, Pencil, Target, Trash2 } from 'lucide-react';
import styles from './SearchPopup.module.scss';
import { useFocus } from '../contexts/FocusContext';
import { soundEngine } from '../utils/audio';
import { isHoldingBucket } from '../utils/buckets';
import { NO_CATEGORY, searchObjectives, type SearchSortKey, type SortDirection } from '../utils/search';
import { BucketSelect } from './BucketSelect';
import { DeadlineBadge } from './DeadlineBadge';
import { ContextMenu } from './ContextMenu';
import { moveToBucketItem } from './bucketMoveItem';
import { SaveTemplateModal } from './SaveTemplateModal';
import { copyPlain } from '../utils/clipboard';
import type { Bucket, ObjectiveCategory, StrategicObjective } from '../types';

const PREFS_KEY = 'search_prefs';

// The toggles and the sort are remembered on this machine; the text and the two filters start empty each time
interface Prefs {
  inDetails: boolean;
  deadlineOnly: boolean;
  sortKey: SearchSortKey;
  directions: Record<SearchSortKey, SortDirection>;
}

const DEFAULT_PREFS: Prefs = { inDetails: false, deadlineOnly: false, sortKey: 'title', directions: { title: 'asc', deadline: 'asc' } };

function loadPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<Prefs> | null;
    if (!raw) return DEFAULT_PREFS;
    const dir = (d: unknown): SortDirection => (d === 'desc' ? 'desc' : 'asc');
    return {
      inDetails: raw.inDetails === true,
      deadlineOnly: raw.deadlineOnly === true,
      sortKey: raw.sortKey === 'deadline' ? 'deadline' : 'title',
      directions: { title: dir(raw.directions?.title), deadline: dir(raw.directions?.deadline) },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

// Categories dressed as buckets, so the same color drop-down can pick them
const asOption = (id: number, name: string, color: string, sort_order: number): Bucket =>
  ({ id, name, color, sort_order, kind: 'custom', x: 0, y: 0, w: 0, h: 0 });

interface Hole { left: number; top: number; right: number; bottom: number }

// The on-screen box of the details pane, which the scrim leaves clear (null while there is no pane)
const measurePane = (): Hole | null => {
  const rect = document.querySelector('[data-details-pane]')?.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  return { left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom) };
};

const sameHole = (a: Hole | null, b: Hole | null) =>
  a === b || (!!a && !!b && a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom);

const SORT_LABELS: Record<SearchSortKey, string> = { title: 'TITLE', deadline: 'DEADLINE' };

interface SearchRowProps {
  obj: StrategicObjective;
  bucket?: Bucket;
  category?: ObjectiveCategory;
  highlighted: boolean;
  holdingBuckets: Bucket[];
  onSelect: (id: number) => void;
  onToggleMission: (id: number) => void;
}

// One result: looks like a Mission list row. Right-click offers the usual task menu.
const SearchRow: FC<SearchRowProps> = ({ obj, bucket, category, highlighted, holdingBuckets, onSelect, onToggleMission }) => {
  const { updateObjective, deleteObjective, duplicateObjective, moveObjectiveToBucket } = useFocus();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const closeSaveTemplate = useCallback(() => setSavingTemplate(false), []);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(obj.text);
  const inputRef = useRef<HTMLInputElement>(null);
  const inMission = obj.is_mission === 1;

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const startRename = () => {
    soundEngine.playEditStart();
    setEditText(obj.text);
    setIsEditing(true);
  };

  const saveRename = () => {
    const text = editText.trim();
    if (text && text !== obj.text) void updateObjective(obj.id, text);
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') saveRename();
    else if (e.key === 'Escape') {
      setEditText(obj.text);
      setIsEditing(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isEditing) return; // keep the native menu in the rename box
    e.preventDefault();
    soundEngine.playClick();
    onSelect(obj.id);
    setMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <div
      className={`${styles.row} ${highlighted ? styles.current : ''}`}
      style={bucket ? { borderColor: bucket.color, background: `color-mix(in srgb, ${bucket.color} 22%, var(--bg-dark))` } : undefined}
      title={bucket ? `Bucket: ${bucket.name}` : undefined}
      data-objective-id={obj.id}
      onClick={() => { if (!isEditing) onSelect(obj.id); }}
      onDoubleClick={() => { if (!isEditing) onToggleMission(obj.id); }}
      onContextMenu={handleContextMenu}
    >
      <span className={styles.bullet} style={{ backgroundColor: category?.color || '#333333' }} />
      {isEditing ? (
        <input
          ref={inputRef}
          className={styles.editInput}
          value={editText}
          autoFocus
          onClick={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
          onChange={e => setEditText(e.target.value)}
          onKeyDown={handleEditKeyDown}
          onBlur={saveRename}
        />
      ) : (
        <span className={styles.text}>{obj.text}</span>
      )}
      {obj.deadline_at && <DeadlineBadge deadline={obj.deadline_at} className={styles.deadline} />}
      {inMission && <span className={styles.mission} title="In Mission">★</span>}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
          items={[
            { label: 'Rename', icon: <Pencil size={12} />, onSelect: startRename },
            moveToBucketItem(holdingBuckets, obj.bucket_id, bucketId => { soundEngine.playClick(); void moveObjectiveToBucket(obj.id, bucketId); }),
            inMission
              ? { label: 'Remove from Mission', icon: <MinusCircle size={12} />, onSelect: () => onToggleMission(obj.id) }
              : { label: 'Add to Mission', icon: <Target size={12} />, onSelect: () => onToggleMission(obj.id) },
            { label: 'Duplicate', icon: <CopyPlus size={12} />, onSelect: () => { void duplicateObjective(obj.id); } },
            { label: 'Copy text', icon: <Copy size={12} />, onSelect: () => { void copyPlain(obj.text); } },
            { label: 'Create template from task', icon: <BookmarkPlus size={12} />, onSelect: () => setSavingTemplate(true) },
            { label: 'Delete', icon: <Trash2 size={12} />, onSelect: () => { soundEngine.playClick(); void deleteObjective(obj.id); } },
          ]}
        />
      )}
      {savingTemplate && <SaveTemplateModal task={obj} onClose={closeSaveTemplate} />}
    </div>
  );
};

interface SearchPopupProps {
  onClose: () => void;
  onOpenDetails: (id: number) => void;
  onCloseDetails: () => void;
  detailsOpen: boolean;
  reservedRight: number; // px kept clear at the right edge (the details pane): the popup centers in what is left
}

// S: find any open task. A list like the Mission list (bucket colors, category dots, deadline icons) with a filter
// box, category and bucket filters, a deadline filter and sorting. The highlighted task's details are always shown
// beside it. Double-click or Shift/Ctrl+Enter toggles Mission, Enter edits the details, Escape closes the popup.
export const SearchPopup: FC<SearchPopupProps> = ({ onClose, onOpenDetails, onCloseDetails, detailsOpen, reservedRight }) => {
  const { objectivePool, buckets, categories, setObjectiveMission } = useFocus();
  // Whether the pane was open before the popup: if not, closing the popup closes it again
  const paneWasOpen = useRef(detailsOpen);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [bucketId, setBucketId] = useState<number | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const updatePrefs = (patch: Partial<Prefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const holdingBuckets = useMemo(() => buckets.filter(isHoldingBucket), [buckets]);
  const bucketById = useMemo(() => new Map(buckets.map(b => [b.id, b])), [buckets]);
  const categoryOptions = useMemo(
    () => [asOption(NO_CATEGORY, 'No category', '#333333', -1), ...categories.map(c => asOption(c.id, c.label, c.color, c.sort_order))],
    [categories],
  );

  const results = useMemo(() => searchObjectives(objectivePool, {
    query,
    inDetails: prefs.inDetails,
    categoryId,
    bucketId,
    deadlineOnly: prefs.deadlineOnly,
    sortKey: prefs.sortKey,
    direction: prefs.directions[prefs.sortKey],
  }), [objectivePool, query, prefs, categoryId, bucketId]);

  // The highlighted task is the one whose details are shown. It stays on the same task (by id) while the filters
  // change, and jumps to the first result when its task drops out of the list. With nothing left in the list the
  // pane keeps showing the last task (it must not come and go while typing).
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const resolvedId = results.some(o => o.id === highlightedId) ? highlightedId : (results[0]?.id ?? null);
  if (resolvedId !== highlightedId) setHighlightedId(resolvedId);

  // Read by the key handler and the effects below, which must not re-run when these change
  const latest = useRef({ results, highlightedId, onOpenDetails, onCloseDetails, onClose, setObjectiveMission });
  useEffect(() => { latest.current = { results, highlightedId, onOpenDetails, onCloseDetails, onClose, setObjectiveMission }; });

  useEffect(() => { inputRef.current?.focus(); }, []);

  // The scrim covers the whole window with a hole where the details pane is. The pane slides in and the popup
  // moves over for a moment, so the box is followed for a little while after anything changes.
  const [hole, setHole] = useState<Hole | null>(null);
  useEffect(() => {
    const measure = () => setHole(prev => {
      const next = measurePane();
      return sameHole(prev, next) ? prev : next;
    });
    const stopAt = performance.now() + 700;
    let frame = 0;
    const follow = () => {
      measure();
      if (performance.now() < stopAt) frame = requestAnimationFrame(follow);
    };
    follow();
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
    };
  }, [detailsOpen, reservedRight]);

  // The details follow the highlight
  useEffect(() => {
    if (highlightedId === null) return;
    latest.current.onOpenDetails(highlightedId);
    listRef.current?.querySelector(`[data-objective-id="${highlightedId}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [highlightedId]);

  // Closing the popup also closes a pane that it opened
  useEffect(() => () => {
    if (!paneWasOpen.current) latest.current.onCloseDetails();
  }, []);

  const toggleMission = (id: number) => {
    const task = latest.current.results.find(o => o.id === id);
    if (!task) return;
    soundEngine.playClick();
    void latest.current.setObjectiveMission(id, task.is_mission !== 1);
  };

  const moveHighlight = (delta: number) => {
    const { results: list, highlightedId: current } = latest.current;
    if (list.length === 0) return;
    const index = list.findIndex(o => o.id === current);
    const next = Math.max(0, Math.min(list.length - 1, (index === -1 ? 0 : index) + delta));
    if (next !== index) {
      soundEngine.playNavSelect();
      setHighlightedId(list[next].id);
    }
  };

  // Keys while the popup is open, in the capture phase so the page behind never sees them:
  //  - Escape: closes the popup
  //  - Tab: only between the search box and the two drop-downs
  //  - Up / Down: move the highlight (on a drop-down they cycle its options instead)
  //  - Enter: edit the highlighted task's details; Shift+Enter / Ctrl+Enter toggle it in Mission
  // Other text boxes (the title or notes being edited in the pane, a row being renamed), an open drop-down, a
  // right-click menu and a dialog keep their own keys.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      const inSelect = !!target?.closest('[role="combobox"], [role="listbox"]');
      const typingElsewhere = !!target && target !== inputRef.current && !!target.closest('input, textarea, select, [contenteditable="true"]');
      if (e.key === 'Escape') {
        if (typingElsewhere || document.querySelector('[data-handles-escape], [role="menu"], [role="dialog"]:not([data-search-popup])')) return;
        e.preventDefault();
        e.stopPropagation();
        latest.current.onClose();
      } else if (e.key === 'Tab') {
        if (typingElsewhere || target?.closest('[role="listbox"]')) return;
        e.preventDefault();
        e.stopPropagation();
        const stops = Array.from(popupRef.current?.querySelectorAll<HTMLElement>('input[type="text"], [role="combobox"]') ?? []);
        if (stops.length === 0) return;
        const at = target ? stops.findIndex(el => el === target || el.contains(target)) : -1;
        stops[(at + (e.shiftKey ? -1 : 1) + stops.length) % stops.length].focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (typingElsewhere || inSelect) return;
        e.preventDefault();
        e.stopPropagation();
        moveHighlight(e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Enter') {
        if (typingElsewhere || inSelect) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey || e.ctrlKey) {
          if (latest.current.highlightedId !== null) toggleMission(latest.current.highlightedId);
        } else {
          window.dispatchEvent(new CustomEvent('objective-details-edit'));
        }
      } else if (!typingElsewhere && !inSelect && (e.key === ' ' || /^[aivb]$/i.test(e.key)) && target !== inputRef.current) {
        // The main screen's shortcuts (timer, views) stay out of it while the popup holds the keyboard
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clickSort = (key: SearchSortKey) => {
    soundEngine.playClick();
    if (key === prefs.sortKey) {
      updatePrefs({ directions: { ...prefs.directions, [key]: prefs.directions[key] === 'asc' ? 'desc' : 'asc' } });
    } else {
      updatePrefs({ sortKey: key });
    }
  };

  const handleSelect = (id: number) => {
    soundEngine.playClick();
    setHighlightedId(id);
    onOpenDetails(id);
  };

  return createPortal(
    <>
    {/* Darkens everything but the popup and the details pane; presses on it go nowhere (and keep the keyboard in the popup) */}
    <div
      className={styles.scrim}
      style={hole ? {
        clipPath: `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${hole.left}px ${hole.top}px, ${hole.left}px ${hole.bottom}px, ${hole.right}px ${hole.bottom}px, ${hole.right}px ${hole.top}px, ${hole.left}px ${hole.top}px)`,
      } : undefined}
      data-hole={hole ? `${hole.left},${hole.top},${hole.right},${hole.bottom}` : undefined}
      onMouseDown={e => e.preventDefault()}
      data-details-barrier
    />
    <div className={styles.layer} style={{ right: reservedRight }}>
      <div
        ref={popupRef}
        className={`card ${styles.popup}`}
        // Pressing on the list, the switches or the scrim keeps the keyboard where it is (usually the search box)
        onMouseDown={e => { if (!(e.target as Element).closest('input, [role="combobox"], [role="listbox"]')) e.preventDefault(); }}
        role="dialog"
        aria-label="Search objectives"
        data-search-popup
        // Pressing in here must not count as "outside" the details pane, which closes itself on those
        data-details-barrier
      >
        <div className={styles.titleRow}>
          <h4 className={styles.title}>SEARCH_OBJECTIVES</h4>
          <span className={styles.count} aria-label="Matches">{results.length} / {objectivePool.length}</span>
        </div>

        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          placeholder="Search objectives..."
          aria-label="Search objectives"
          value={query}
          onChange={e => setQuery(e.target.value)}
          spellCheck={false}
        />

        <div className={styles.filters}>
          <BucketSelect
            className={styles.select}
            buckets={categoryOptions}
            value={categoryId}
            onChange={setCategoryId}
            allLabel="All categories"
            onClear={() => setCategoryId(null)}
            ariaLabel="Category filter"
            title="Only tasks in this category"
          />
          <BucketSelect
            className={styles.select}
            buckets={holdingBuckets}
            value={bucketId}
            onChange={setBucketId}
            allLabel="All buckets"
            onClear={() => setBucketId(null)}
            ariaLabel="Bucket filter"
            title="Only tasks in this bucket"
          />
        </div>

        <div className={styles.options}>
          <button
            type="button"
            role="switch"
            tabIndex={-1}
            aria-checked={prefs.inDetails}
            className={`${styles.toggle} ${prefs.inDetails ? styles.on : ''}`}
            onClick={() => { soundEngine.playClick(); updatePrefs({ inDetails: !prefs.inDetails }); }}
            title="Also match the text of the details, not just the title"
          >
            <span className={styles.knob} />
            IN_DETAILS
          </button>
          <button
            type="button"
            role="switch"
            tabIndex={-1}
            aria-checked={prefs.deadlineOnly}
            className={`${styles.toggle} ${prefs.deadlineOnly ? styles.on : ''}`}
            onClick={() => { soundEngine.playClick(); updatePrefs({ deadlineOnly: !prefs.deadlineOnly }); }}
            title="Only tasks that have a deadline"
          >
            <span className={styles.knob} />
            WITH_DEADLINE
          </button>
          <span className={styles.sortGroup}>
            {(['title', 'deadline'] as const).map(key => {
              const direction = prefs.directions[key];
              return (
                <button
                  key={key}
                  type="button"
                  tabIndex={-1}
                  aria-pressed={prefs.sortKey === key}
                  aria-label={`Sort by ${SORT_LABELS[key].toLowerCase()}, ${direction === 'asc' ? 'ascending' : 'descending'}`}
                  className={`${styles.sortBtn} ${prefs.sortKey === key ? styles.on : ''}`}
                  onClick={() => clickSort(key)}
                  title={key === 'title'
                    ? (direction === 'asc' ? 'A to Z (click for Z to A)' : 'Z to A (click for A to Z)')
                    : (direction === 'asc' ? 'Soonest first (click for latest first)' : 'Latest first (click for soonest first)')}
                >
                  {SORT_LABELS[key]}
                  {direction === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                </button>
              );
            })}
          </span>
        </div>

        <div ref={listRef} className={styles.list}>
          {results.map(o => (
            <SearchRow
              key={o.id}
              obj={o}
              bucket={bucketById.get(o.bucket_id ?? -1)}
              category={categories.find(c => c.id === o.category_id)}
              highlighted={highlightedId === o.id}
              holdingBuckets={holdingBuckets}
              onSelect={handleSelect}
              onToggleMission={toggleMission}
            />
          ))}
          {results.length === 0 && <div className={styles.empty}>NO_MATCHES</div>}
        </div>
      </div>
    </div>
    </>,
    document.body,
  );
};
