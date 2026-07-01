function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="text-center max-w-xl">
        <h1 className="text-4xl sm:text-5xl font-semibold text-gray-900 tracking-tight mb-4">
          Smart Business Profile
        </h1>
        <p className="text-lg sm:text-xl text-gray-500 mb-8">
          Create and share a professional digital business profile in minutes.
        </p>
        <button
          type="button"
          className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          Create Business Profile
        </button>
      </div>
    </div>
  )
}

export default App
