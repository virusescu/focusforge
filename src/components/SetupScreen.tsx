import { type FC, useState } from 'react';
import styles from './SetupScreen.module.scss';
import { useAuth } from '../contexts/AuthContext';

export const SetupScreen: FC = () => {
  const { completeSetup } = useAuth();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!url.trim() || !token.trim()) {
      setError('Both fields are required');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await completeSetup(url.trim(), token.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect to database');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.title}>DATABASE_SETUP</div>
      <div className={styles.subtitle}>TURSO_CREDENTIALS_REQUIRED</div>

      <div className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>TURSO_DATABASE_URL</label>
          <input
            className={styles.input}
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="libsql://your-db.turso.io"
            disabled={loading}
            autoFocus
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>TURSO_AUTH_TOKEN</label>
          <input
            className={styles.input}
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="eyJhbGciOi..."
            disabled={loading}
          />
        </div>

        <button className={styles.connectBtn} onClick={handleConnect} disabled={loading}>
          {loading ? 'CONNECTING...' : 'CONNECT'}
        </button>

        {error && <div className={styles.error}>ERROR: {error}</div>}
      </div>

      <div className={styles.hint}>
        Create a free database at turso.tech, then run:<br />
        <code>turso db tokens create your-db-name</code>
      </div>
    </div>
  );
};
