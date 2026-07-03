import { createContext, useContext, useState } from 'react'

export interface ProfileData {
  id: string | null
  slug: string | null
  ownerId: string | null
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
  existingLogoUrl: string | null
}

const defaultProfileData: ProfileData = {
  id: null,
  slug: null,
  ownerId: null,
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
  existingLogoUrl: null,
}

interface ProfileContextValue {
  profileData: ProfileData
  setProfileData: (data: ProfileData) => void
  clearProfile: () => void
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profileData, setProfileData] = useState<ProfileData>(defaultProfileData)

  const clearProfile = () => {
    setProfileData(defaultProfileData)
  }

  return (
    <ProfileContext.Provider value={{ profileData, setProfileData, clearProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext)
  if (!ctx) {
    throw new Error('useProfile must be used within a ProfileProvider')
  }
  return ctx
}
