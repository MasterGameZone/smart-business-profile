import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ProfileProvider } from './context/ProfileContext.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { testSupabaseConnection } from './lib/supabase.ts'
import './index.css'
import App from './App.tsx'

testSupabaseConnection()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ProfileProvider>
          <App />
        </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
