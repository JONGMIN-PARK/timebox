import { BrowserRouter, Routes, Route } from "react-router-dom";

function Dashboard() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          TimeBox
        </h1>
      </header>
      <main className="p-6">
        <p className="text-slate-600 dark:text-slate-400">
          Personal Schedule Manager - Coming Soon
        </p>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
