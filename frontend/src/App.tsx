import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './api/supabase'
import { onSignedOut, rememberSession, startingSession } from './sessionBackup'
import Nav from './components/Nav'
import PlanLimitBanner from './components/PlanLimitBanner'
import PublicNav from './components/PublicNav'
import PlanProvider from './plan/PlanProvider'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Home from './pages/Home'
import ConfirmHost from './components/ConfirmHost'
import NoticeBanner from './components/NoticeBanner'
import { getLang, loadEnglish, setLang, t, type Lang } from './i18n'
import StatusLine from './components/StatusLine'
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


// Every page is its own file: the first screen loads quickly, and the rest are fetched in the
// background right after, so moving between pages stays instant.
const PAGES = {
  Admin: () => import('./pages/Admin'),
  AI: () => import('./pages/AI'),
  Calendar: () => import('./pages/Calendar'),
  Calories: () => import('./pages/Calories'),
  Dishes: () => import('./pages/Dishes'),
  NotFound: () => import('./pages/NotFound'),
  Pricing: () => import('./pages/Pricing'),
  Support: () => import('./pages/Support'),
  Help: () => import('./pages/Help'),
  ResetPassword: () => import('./pages/ResetPassword'),
  Profile: () => import('./pages/Profile'),
  Recipes: () => import('./pages/Recipes'),
  Shopping: () => import('./pages/Shopping'),
  Settings: () => import('./pages/Settings'),
  Photo: () => import('./pages/Photo'),
  Legal: () => import('./pages/Legal'),
}
const Admin = lazy(PAGES.Admin)
const AI = lazy(PAGES.AI)
const Calendar = lazy(PAGES.Calendar)
const Calories = lazy(PAGES.Calories)
const Dishes = lazy(PAGES.Dishes)
const NotFound = lazy(PAGES.NotFound)
const Pricing = lazy(PAGES.Pricing)
const Support = lazy(PAGES.Support)
const Help = lazy(PAGES.Help)
const ResetPassword = lazy(PAGES.ResetPassword)
const Profile = lazy(PAGES.Profile)
const Recipes = lazy(PAGES.Recipes)
const Shopping = lazy(PAGES.Shopping)
const Settings = lazy(PAGES.Settings)
const Photo = lazy(PAGES.Photo)
const Privacy = lazy(() => PAGES.Legal().then((m) => ({ default: m.Privacy })))
const Terms = lazy(() => PAGES.Legal().then((m) => ({ default: m.Terms })))

function preloadPages() {
  const run = () => Object.values(PAGES).forEach((load) => void load().catch(() => {}))
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 1500)
}

function App() {
  const [lang, setLangState] = useState(getLang)
  const changeLang = async (l: Lang) => {
    if (l === 'en') await loadEnglish()
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
    // a failed e-mail link or Google sign-in comes back with the reason in the address; show it on the sign-in page
    const { pathname, hash } = window.location
    if (/error_code=|error=/.test(hash) && pathname !== '/auth' && pathname !== '/reset') {
      window.location.replace(`/auth${hash}`)
      return
    }
    void startingSession().then(setSession)
    preloadPages()
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      // the first session comes from startingSession, which can still restore it from the backup
      if (event === 'INITIAL_SESSION') return
      if (event === 'SIGNED_OUT') onSignedOut()
      else if (s) rememberSession(s)
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return null

  return (
    <LangContext.Provider value={{ lang, changeLang, units, changeUnits, energy, changeEnergy, dateFormat, changeDateFormat }}>
    <BrowserRouter key={`${lang}-${units}-${energy}-${dateFormat}`}>
      <PlanProvider signedIn={!!session}>
      <div className="scroll-bar" aria-hidden="true" />
      {session ? <Nav /> : <PublicNav />}
      <ConfirmHost />
      <main className="page">
      <NoticeBanner />
      {session && <PlanLimitBanner />}
      <Suspense fallback={<StatusLine text={t('Завантаження…')} />}>
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
        <Route path="/photo" element={session ? <Photo /> : <Navigate to="/auth" />} />
        <Route
          path="/calendar"
          element={session ? <Calendar /> : <Navigate to="/auth" />}
        />
        {/* «Норма дня» became part of «Калорії й вода» */}
        <Route path="/nutrition" element={<Navigate to="/calories" replace />} />
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
      </Suspense>
      </main>
      </PlanProvider>
    </BrowserRouter>
    </LangContext.Provider>
  )
}

export default App
