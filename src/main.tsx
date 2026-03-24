import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.scss'
import { initDb } from './db'
import { UserProvider } from './contexts/UserContext'

initDb().catch(console.error).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <UserProvider>
        <App />
      </UserProvider>
    </StrictMode>,
  )
});

