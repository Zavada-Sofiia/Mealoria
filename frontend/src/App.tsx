import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './api/supabase'
import Nav from './components/Nav'
import Auth from './pages/Auth'
import Calendar from './pages/Calendar'
import Dishes from './pages/Dishes'
import Profile from './pages/Profile'

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
      {session && <Nav />}
      <Routes>
        <Route path="/auth" element={session ? <Navigate to="/" /> : <Auth />} />
        <Route
          path="/"
          element={session ? <Calendar /> : <Navigate to="/auth" />}
        />
        <Route
          path="/dishes"
          element={session ? <Dishes /> : <Navigate to="/auth" />}
        />
        <Route
          path="/profile"
          element={session ? <Profile /> : <Navigate to="/auth" />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
