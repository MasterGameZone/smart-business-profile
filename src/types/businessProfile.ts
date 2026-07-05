/**
 * TypeScript types corresponding to the `business_profiles` table
 * created in supabase/migrations/20260702000000_create_business_profiles.sql
 */

export type JsonObject = Record<string, unknown>
export type SocialLinks = Record<string, string>

export interface BusinessProfileRow {
  id: string
  business_name: string
  owner_name: string
  business_category: string
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
}

export interface BusinessProfileInsert {
  id?: string
  business_name: string
  owner_name: string
  business_category: string
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
    }
  }
}
