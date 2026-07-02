import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage.tsx'
import CreateProfilePage from './pages/CreateProfilePage.tsx'
import ProfilePreviewPage from './pages/ProfilePreviewPage.tsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/create-profile" element={<CreateProfilePage />} />
      <Route path="/profile-preview" element={<ProfilePreviewPage />} />
    </Routes>
  )
}

export default App
