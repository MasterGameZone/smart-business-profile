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
import DirectoryPage from './pages/DirectoryPage.tsx'
import StartBusinessPage from './pages/StartBusinessPage.tsx'
import BusinessHomePage from './pages/BusinessHomePage.tsx'
import FavoritesPage from './pages/FavoritesPage.tsx'
import CustomerProfileSettingsPage from './pages/CustomerProfileSettingsPage.tsx'
import CustomerMyActivityPage from './pages/CustomerMyActivityPage.tsx'
import CustomerCommunityPage from './pages/CustomerCommunityPage.tsx'
import CustomerNotificationsPage from './pages/CustomerNotificationsPage.tsx'
import CustomerHelpFeedbackPage from './pages/CustomerHelpFeedbackPage.tsx'
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
      <Route path="/directory" element={<DirectoryPage />} />
      <Route
        path="/start-business"
        element={
          <ProtectedRoute>
            <StartBusinessPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/business-home"
        element={
          <ProtectedRoute>
            <BusinessHomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/favorites"
        element={
          <ProtectedRoute>
            <FavoritesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/profile-settings"
        element={
          <ProtectedRoute>
            <CustomerProfileSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/my-activity"
        element={
          <ProtectedRoute>
            <CustomerMyActivityPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/community"
        element={
          <ProtectedRoute>
            <CustomerCommunityPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/notifications"
        element={
          <ProtectedRoute>
            <CustomerNotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/help-feedback"
        element={
          <ProtectedRoute>
            <CustomerHelpFeedbackPage />
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
