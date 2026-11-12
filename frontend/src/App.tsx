import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './api/supabase'
import Nav from './components/Nav'
import PlanLimitBanner from './components/PlanLimitBanner'
import PublicNav from './components/PublicNav'
import PlanProvider from './plan/PlanProvider'
import Admin from './pages/Admin'
import AI from './pages/AI'
import Auth from './pages/Auth'
import Calendar from './pages/Calendar'
import Calories from './pages/Calories'
import Dashboard from './pages/Dashboard'
import Dishes from './pages/Dishes'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
import Pricing from './pages/Pricing'
import Support from './pages/Support'
import Help from './pages/Help'
import { Privacy, Terms } from './pages/Legal'
import ResetPassword from './pages/ResetPassword'
import Profile from './pages/Profile'
import Recipes from './pages/Recipes'
import Shopping from './pages/Shopping'
import ConfirmHost from './components/ConfirmHost'
import NoticeBanner from './components/NoticeBanner'
import { getLang, setLang, type Lang } from './i18n'
import { LangContext } from './i18n/context'
import {
  getDateFormat,
  getEnergy,
  getUnits,
  setDateFormat,
  setEnergy,
  setUnits,
  type DateFormat,
  type Energy,
  type Units,
} from './units'
import Settings from './pages/Settings'
import Nutrition from './pages/Nutrition'

function App() {
  const [lang, setLangState] = useState(getLang)
  const changeLang = (l: Lang) => {
    setLang(l)
    setLangState(l)
  }
  const [units, setUnitsState] = useState(getUnits)
  const changeUnits = (u: Units) => {
    setUnits(u)
    setUnitsState(u)
  }
  const [energy, setEnergyState] = useState(getEnergy)
  const changeEnergy = (e: Energy) => {
    setEnergy(e)
    setEnergyState(e)
  }
  const [dateFormat, setDateFormatState] = useState(getDateFormat)
  const changeDateFormat = (f: DateFormat) => {
    setDateFormat(f)
    setDateFormatState(f)
  }
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null

  return (
    <LangContext.Provider value={{ lang, changeLang, units, changeUnits, energy, changeEnergy, dateFormat, changeDateFormat }}>
    <BrowserRouter key={`${lang}-${units}-${energy}-${dateFormat}`}>
      <PlanProvider signedIn={!!session}>
      {session ? <Nav /> : <PublicNav />}
      <ConfirmHost />
      <main className="page">
      <NoticeBanner />
      {session && <PlanLimitBanner />}
      <Routes>
        <Route path="/auth" element={session ? <Navigate to="/today" /> : <Auth />} />
        <Route
          path="/"
          element={<Home signedIn={!!session} />}
        />
        <Route
          path="/today"
          element={session ? <Dashboard /> : <Navigate to="/auth" />}
        />
        <Route path="/ai" element={session ? <AI /> : <Navigate to="/auth" />} />
        <Route
          path="/calendar"
          element={session ? <Calendar /> : <Navigate to="/auth" />}
        />
        <Route path="/nutrition" element={session ? <Nutrition /> : <Navigate to="/auth" />} />
        <Route path="/settings" element={session ? <Settings /> : <Navigate to="/auth" />} />
        <Route path="/staff" element={session ? <Admin /> : <NotFound />} />
        <Route path="/pricing" element={<Pricing session={session} />} />
        <Route path="/support" element={<Support />} />
        <Route path="/help" element={<Help session={session} />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/reset" element={<ResetPassword />} />
        <Route path="/terms" element={<Terms />} />
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
        <Route path="*" element={<NotFound />} />
      </Routes>
      </main>
      </PlanProvider>
    </BrowserRouter>
    </LangContext.Provider>
  )
}

export default App
