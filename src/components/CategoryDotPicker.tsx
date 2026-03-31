import { type FC } from 'react';
import { Plus } from 'lucide-react';
import styles from './CategoryDotPicker.module.scss';
import type { ObjectiveCategory } from '../types';
import { soundEngine } from '../utils/audio';

interface Props {
  categories: ObjectiveCategory[];
  selectedCategoryId: number | null;
  onSelect: (categoryId: number | null) => void;
  onManage: () => void;
}

export const CategoryDotPicker: FC<Props> = ({ categories, selectedCategoryId, onSelect, onManage }) => {
  const handleDotClick = (e: React.MouseEvent, categoryId: number) => {
    e.stopPropagation();
    soundEngine.playClick();
    onSelect(selectedCategoryId === categoryId ? null : categoryId);
  };

  const handleManageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    soundEngine.playClick();
    onManage();
  };

  return (
    <div className={styles.picker}>
      {categories.map(cat => (
        <button
          key={cat.id}
          className={`${styles.dot} ${selectedCategoryId === cat.id ? styles.selected : ''}`}
          style={{ backgroundColor: cat.color }}
          onClick={(e) => handleDotClick(e, cat.id)}
          onMouseEnter={() => soundEngine.playHover()}
          title={cat.label}
          type="button"
        />
      ))}
      <button
        className={styles.addDot}
        onClick={handleManageClick}
        onMouseEnter={() => soundEngine.playHover()}
        title="Manage Categories"
        type="button"
      >
        <Plus size={8} />
      </button>
    </div>
  );
};
