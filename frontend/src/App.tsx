import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './api/supabase'
import Nav from './components/Nav'
import PublicNav from './components/PublicNav'
import Auth from './pages/Auth'
import Calendar from './pages/Calendar'
import Calories from './pages/Calories'
import Dishes from './pages/Dishes'
import Home from './pages/Home'
import Pricing from './pages/Pricing'
import Support from './pages/Support'
import Profile from './pages/Profile'
import Recipes from './pages/Recipes'
import Shopping from './pages/Shopping'

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null

  return (
    <BrowserRouter>
      {session ? <Nav /> : <PublicNav />}
      <main className="page">
      <Routes>
        <Route path="/auth" element={session ? <Navigate to="/" /> : <Auth />} />
        <Route
          path="/"
          element={session ? <Calendar /> : <Home />}
        />
        <Route path="/pricing" element={<Pricing session={session} />} />
        <Route path="/support" element={<Support />} />
        <Route
          path="/dishes"
          element={session ? <Dishes /> : <Navigate to="/auth" />}
        />
        <Route
          path="/recipes"
          element={session ? <Recipes /> : <Navigate to="/auth" />}
        />
        <Route
          path="/shopping"
          element={session ? <Shopping /> : <Navigate to="/auth" />}
        />
        <Route
          path="/calories"
          element={session ? <Calories /> : <Navigate to="/auth" />}
        />
        <Route
          path="/profile"
          element={session ? <Profile /> : <Navigate to="/auth" />}
        />
      </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App
