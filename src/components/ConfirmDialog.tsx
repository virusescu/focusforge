import { type FC, useRef, useEffect } from 'react';
import { ModalFrame } from './ModalFrame';
import form from './TemplateForm.module.scss';
import styles from './ConfirmDialog.module.scss';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// In-app replacement for window.confirm for destructive actions. It starts on Cancel and has no
// "Enter confirms" shortcut, so a stray keypress can never delete anything.
export const ConfirmDialog: FC<ConfirmDialogProps> = ({ title, message, confirmLabel, cancelLabel = 'CANCEL', onConfirm, onCancel }) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);

  return (
    <ModalFrame
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button ref={cancelRef} className={form.secondaryBtn} onClick={onCancel}>{cancelLabel}</button>
          <button className={styles.dangerBtn} onClick={onConfirm}>{confirmLabel}</button>
        </>
      }
    >
      <p className={styles.message}>{message}</p>
    </ModalFrame>
  );
};
