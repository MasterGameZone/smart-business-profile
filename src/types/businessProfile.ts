/**
 * TypeScript types corresponding to the `business_profiles` table
 * created in supabase/migrations/20260702000000_create_business_profiles.sql
 */

export type JsonObject = Record<string, unknown>
export type SocialLinks = Record<string, string>

export interface BusinessProfileFaqValue {
  question: string
  answer: string
}

export interface BusinessProfileProductValue {
  name: string
  description: string
  price: string | null
}

export interface BusinessProfileQualificationValue {
  title: string
  issuingOrganization: string | null
  year: number | null
  description: string | null
  documentFileName?: string | null
  documentFilePath?: string | null
  documentMimeType?: string | null
}

export interface BusinessProfileDocumentRow {
  id: string
  business_profile_id: string
  owner_id: string
  document_name: string | null
  file_name: string
  file_path: string
  mime_type: string
  created_at: string
}

export interface BusinessProfileRow {
  id: string
  business_name: string
  owner_name: string
  business_category: string
  business_subcategories: string[] | null
  established_year: number | null
  years_of_experience: number | null
  highlights: string[] | null
  faqs: BusinessProfileFaqValue[] | null
  products_menu_packages: BusinessProfileProductValue[] | null
  qualifications: BusinessProfileQualificationValue[] | null
  phone_number: string
  whatsapp_number: string | null
  email: string | null
  website: string | null
  address: string | null
  about_business: string | null
  logo_url: string | null
  tagline: string | null
  services: unknown[] | null
  working_hours: JsonObject | null
  google_maps_url: string | null
  social_links: SocialLinks | null
  keywords: string[] | null
  cover_banner_url: string | null
  gallery_images: string[] | null
  is_public: boolean | null
  slug: string
  owner_id: string | null
  created_at: string
  updated_at: string
  business_profile_documents?: BusinessProfileDocumentRow[] | null
}

export interface BusinessProfileInsert {
  id?: string
  business_name: string
  owner_name: string
  business_category: string
  business_subcategories?: string[] | null
  established_year?: number | null
  years_of_experience?: number | null
  highlights?: string[] | null
  faqs?: BusinessProfileFaqValue[] | null
  products_menu_packages?: BusinessProfileProductValue[] | null
  qualifications?: BusinessProfileQualificationValue[] | null
  phone_number: string
  whatsapp_number?: string | null
  email?: string | null
  website?: string | null
  address?: string | null
  about_business?: string | null
  logo_url?: string | null
  tagline?: string | null
  services?: unknown[] | null
  working_hours?: JsonObject | null
  google_maps_url?: string | null
  social_links?: SocialLinks | null
  keywords?: string[] | null
  cover_banner_url?: string | null
  gallery_images?: string[] | null
  is_public?: boolean | null
  slug: string
  owner_id?: string | null
  created_at?: string
  updated_at?: string
}

export interface BusinessProfileUpdate {
  business_name?: string
  owner_name?: string
  business_category?: string
  business_subcategories?: string[] | null
  established_year?: number | null
  years_of_experience?: number | null
  highlights?: string[] | null
  faqs?: BusinessProfileFaqValue[] | null
  products_menu_packages?: BusinessProfileProductValue[] | null
  qualifications?: BusinessProfileQualificationValue[] | null
  phone_number?: string
  whatsapp_number?: string | null
  email?: string | null
  website?: string | null
  address?: string | null
  about_business?: string | null
  logo_url?: string | null
  tagline?: string | null
  services?: unknown[] | null
  working_hours?: JsonObject | null
  google_maps_url?: string | null
  social_links?: SocialLinks | null
  keywords?: string[] | null
  cover_banner_url?: string | null
  gallery_images?: string[] | null
  is_public?: boolean | null
  slug?: string
  owner_id?: string | null
  updated_at?: string
}

export type PublicBusinessProfileRow = Pick<
  BusinessProfileRow,
  | 'id'
  | 'business_name'
  | 'owner_name'
  | 'business_category'
  | 'address'
  | 'about_business'
  | 'logo_url'
  | 'slug'
  | 'owner_id'
  | 'created_at'
  | 'updated_at'
>

export interface Database {
  public: {
    Tables: {
      business_profiles: {
        Row: BusinessProfileRow
        Insert: BusinessProfileInsert
        Update: BusinessProfileUpdate
      }
      business_profile_documents: {
        Row: BusinessProfileDocumentRow
        Insert: Omit<BusinessProfileDocumentRow, 'id' | 'created_at'>
        Update: Partial<Omit<BusinessProfileDocumentRow, 'id' | 'created_at'>>
      }
    }
  }
}
