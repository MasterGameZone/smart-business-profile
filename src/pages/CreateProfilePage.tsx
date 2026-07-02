import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface FormData {
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

interface FormErrors {
  businessName?: string
  ownerName?: string
  businessCategory?: string
  phoneNumber?: string
}

const categories = [
  'Retail',
  'Food & Beverage',
  'Technology',
  'Health & Wellness',
  'Education',
  'Professional Services',
  'Other',
]

function CreateProfilePage() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState<FormData>({
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
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [logoFileName, setLogoFileName] = useState<string>('')

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setFormData((prev) => ({ ...prev, logo: file }))
    setLogoFileName(file ? file.name : '')
  }

  const validate = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.businessName.trim()) {
      newErrors.businessName = 'Business Name is required'
    }
    if (!formData.ownerName.trim()) {
      newErrors.ownerName = 'Owner Name is required'
    }
    if (!formData.businessCategory) {
      newErrors.businessCategory = 'Business Category is required'
    }
    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone Number is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault()
    validate()
  }

  const inputBase =
    'w-full px-4 py-2.5 border rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-[700px] mx-auto">
        <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 tracking-tight mb-2">
          Create Business Profile
        </h1>
        <p className="text-gray-500 mb-8">
          Fill in your business details below.
        </p>

        <form onSubmit={handleContinue} className="space-y-6">
          {/* Business Name */}
          <div>
            <label
              htmlFor="businessName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Business Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="businessName"
              name="businessName"
              value={formData.businessName}
              onChange={handleChange}
              className={`${inputBase} ${
                errors.businessName ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.businessName && (
              <p className="mt-1 text-sm text-red-600">
                {errors.businessName}
              </p>
            )}
          </div>

          {/* Owner Name */}
          <div>
            <label
              htmlFor="ownerName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Owner Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="ownerName"
              name="ownerName"
              value={formData.ownerName}
              onChange={handleChange}
              className={`${inputBase} ${
                errors.ownerName ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.ownerName && (
              <p className="mt-1 text-sm text-red-600">{errors.ownerName}</p>
            )}
          </div>

          {/* Business Category */}
          <div>
            <label
              htmlFor="businessCategory"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Business Category <span className="text-red-500">*</span>
            </label>
            <select
              id="businessCategory"
              name="businessCategory"
              value={formData.businessCategory}
              onChange={handleChange}
              className={`${inputBase} bg-white ${
                errors.businessCategory ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {errors.businessCategory && (
              <p className="mt-1 text-sm text-red-600">
                {errors.businessCategory}
              </p>
            )}
          </div>

          {/* Phone Number */}
          <div>
            <label
              htmlFor="phoneNumber"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              className={`${inputBase} ${
                errors.phoneNumber ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.phoneNumber && (
              <p className="mt-1 text-sm text-red-600">
                {errors.phoneNumber}
              </p>
            )}
          </div>

          {/* WhatsApp Number */}
          <div>
            <label
              htmlFor="whatsappNumber"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              WhatsApp Number
            </label>
            <input
              type="tel"
              id="whatsappNumber"
              name="whatsappNumber"
              value={formData.whatsappNumber}
              onChange={handleChange}
              className={`${inputBase} border-gray-300`}
            />
          </div>

          {/* Email Address */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`${inputBase} border-gray-300`}
            />
          </div>

          {/* Website */}
          <div>
            <label
              htmlFor="website"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Website
            </label>
            <input
              type="url"
              id="website"
              name="website"
              value={formData.website}
              onChange={handleChange}
              className={`${inputBase} border-gray-300`}
            />
          </div>

          {/* Address */}
          <div>
            <label
              htmlFor="address"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Address
            </label>
            <textarea
              id="address"
              name="address"
              rows={3}
              value={formData.address}
              onChange={handleChange}
              className={`${inputBase} border-gray-300 resize-none`}
            />
          </div>

          {/* About Business */}
          <div>
            <label
              htmlFor="aboutBusiness"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              About Business
            </label>
            <textarea
              id="aboutBusiness"
              name="aboutBusiness"
              rows={4}
              value={formData.aboutBusiness}
              onChange={handleChange}
              className={`${inputBase} border-gray-300 resize-none`}
            />
          </div>

          {/* Business Logo */}
          <div>
            <label
              htmlFor="logo"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Business Logo
            </label>
            <input
              type="file"
              id="logo"
              name="logo"
              accept="image/*"
              onChange={handleLogoChange}
              className={`${inputBase} border-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100`}
            />
            {logoFileName && (
              <p className="mt-1 text-sm text-gray-500">
                Selected: {logoFileName}
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button
              type="submit"
              className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateProfilePage
