import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage.tsx'
import CreateProfilePage from './pages/CreateProfilePage.tsx'
import ProfilePreviewPage from './pages/ProfilePreviewPage.tsx'

export interface FormData {
  businessName: string
  ownerName: string
  businessCategory: string
  phoneNumber: string
  whatsappNumber: string
  email: string
  website: string
  address: string
  aboutBusiness: string
  logo: File | null
}

const defaultFormData: FormData = {
  businessName: '',
  ownerName: '',
  businessCategory: '',
  phoneNumber: '',
  whatsappNumber: '',
  email: '',
  website: '',
  address: '',
  aboutBusiness: '',
  logo: null,
}

function App() {
  const [formData, setFormData] = useState<FormData>(defaultFormData)

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/create-profile"
        element={
          <CreateProfilePage
            formData={formData}
            onChangeFormData={setFormData}
          />
        }
      />
      <Route
        path="/profile-preview"
        element={<ProfilePreviewPage formData={formData} />}
      />
    </Routes>
  )
}

export default App
