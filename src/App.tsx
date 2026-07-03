import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage.tsx'
import CreateProfilePage from './pages/CreateProfilePage.tsx'
import ProfilePreviewPage from './pages/ProfilePreviewPage.tsx'
import PublicBusinessProfilePage from './pages/PublicBusinessProfilePage.tsx'
import LoginPage from './pages/auth/LoginPage.tsx'
import SignUpPage from './pages/auth/SignUpPage.tsx'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.tsx'
import ResetPasswordPage from './pages/auth/ResetPasswordPage.tsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/create-profile" element={<CreateProfilePage />} />
      <Route path="/profile-preview" element={<ProfilePreviewPage />} />
      <Route path="/business/:slug" element={<PublicBusinessProfilePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
    </Routes>
  )
}

export default App
