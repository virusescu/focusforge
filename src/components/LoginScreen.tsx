import { type FC, useState } from 'react';
import styles from './LoginScreen.module.scss';
import { useAuth } from '../contexts/AuthContext';

export const LoginScreen: FC = () => {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await login();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.title}>FOCUS_FORGE</div>
      <div className={styles.subtitle}>OPERATOR_AUTHENTICATION_REQUIRED</div>
      <button className={styles.loginBtn} onClick={handleLogin} disabled={loading}>
        {loading ? 'AUTHENTICATING...' : 'SIGN_IN_WITH_GOOGLE'}
      </button>
      {error && <div className={styles.error}>ERROR: {error}</div>}
    </div>
  );
};
