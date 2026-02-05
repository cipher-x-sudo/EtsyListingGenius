import React from 'react';
import MockupGenerator from './components/MockupGenerator';

function App() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-md flex items-center justify-center text-white font-bold text-lg">E</div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">EtsyListing<span className="text-orange-600">Genius</span></h1>
          </div>
          <div className="text-sm text-slate-500">
            Powered by Gemini
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow py-6 px-4 sm:px-6 lg:px-8">
          <MockupGenerator />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-400 text-sm">
          <p>&copy; {new Date().getFullYear()} EtsyListingGenius. AI results may vary. Always review before publishing.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;