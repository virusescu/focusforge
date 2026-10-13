import type { FC } from 'react';
import styles from './BucketTag.module.scss';
import type { Bucket } from '../types';

interface BucketTagProps {
  bucket: Bucket | null | undefined;
  className?: string;
}

// Colored dot + bucket name, in the bucket's color. Renders nothing if the bucket isn't known.
export const BucketTag: FC<BucketTagProps> = ({ bucket, className }) => {
  if (!bucket) return null;
  return (
    <span
      className={`${styles.tag} ${className ?? ''}`}
      style={{ color: bucket.color }}
      data-bucket-tag={bucket.id}
      title={`Bucket: ${bucket.name}`}
    >
      <span className={styles.dot} style={{ backgroundColor: bucket.color }} data-bucket-dot />
      <span className={styles.name}>{bucket.name}</span>
    </span>
  );
};
