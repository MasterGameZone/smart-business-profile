import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage.tsx'
import CreateProfilePage from './pages/CreateProfilePage.tsx'
import ProfilePreviewPage from './pages/ProfilePreviewPage.tsx'
import PublicBusinessProfilePage from './pages/PublicBusinessProfilePage.tsx'
import LoginPage from './pages/auth/LoginPage.tsx'
import SignUpPage from './pages/auth/SignUpPage.tsx'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.tsx'
import ResetPasswordPage from './pages/auth/ResetPasswordPage.tsx'
import DashboardPage from './pages/DashboardPage.tsx'
import ProtectedRoute from './components/ProtectedRoute.tsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/create-profile"
        element={
          <ProtectedRoute>
            <CreateProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile-preview"
        element={
          <ProtectedRoute>
            <ProfilePreviewPage />
          </ProtectedRoute>
        }
      />
      <Route path="/business/:slug" element={<PublicBusinessProfilePage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
    </Routes>
  )
}

export default App
