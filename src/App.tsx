import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage.tsx'
import CreateProfilePage from './pages/CreateProfilePage.tsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/create-profile" element={<CreateProfilePage />} />
    </Routes>
  )
}

export default App
