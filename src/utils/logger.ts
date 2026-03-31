import { info, error, debug, warn } from '@tauri-apps/plugin-log';

// Simple logger that outputs to Tauri terminal (in dev mode)
export const logger = {
  log: (...args: unknown[]) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    info(message);
  },

  info: (...args: unknown[]) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    info(message);
  },

  error: (...args: unknown[]) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    error(message);
  },

  warn: (...args: unknown[]) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    warn(message);
  },

  debug: (...args: unknown[]) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    debug(message);
  }
};
