import { createContext, useContext, useState } from 'react'

export interface ProfileData {
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

const STORAGE_KEY = 'sbp_profile_data'

const defaultProfileData: ProfileData = {
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

type StoredProfileData = Omit<ProfileData, 'logo'>

function loadFromStorage(): ProfileData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultProfileData
    const stored = JSON.parse(raw) as StoredProfileData
    return { ...defaultProfileData, ...stored, logo: null }
  } catch {
    return defaultProfileData
  }
}

function saveToStorage(data: ProfileData): void {
  try {
    const { logo: _logo, ...rest } = data
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
  } catch {
  }
}

function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
  }
}

interface ProfileContextValue {
  profileData: ProfileData
  setProfileData: (data: ProfileData) => void
  clearProfile: () => void
  saveProfile: () => void
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profileData, setProfileDataState] = useState<ProfileData>(loadFromStorage)

  const setProfileData = (data: ProfileData) => {
    saveToStorage(data)
    setProfileDataState(data)
  }

  const clearProfile = () => {
    clearStorage()
    setProfileDataState(defaultProfileData)
  }

  const saveProfile = () => {
    saveToStorage(profileData)
  }

  return (
    <ProfileContext.Provider value={{ profileData, setProfileData, clearProfile, saveProfile }}>
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
