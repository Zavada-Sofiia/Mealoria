import { createContext, useContext } from 'react'
import { getLang, type Lang } from '.'
import { getUnits, type Units } from '../units'

export const LangContext = createContext<{
  lang: Lang
  changeLang: (l: Lang) => void
  units: Units
  changeUnits: (u: Units) => void
}>({
  lang: getLang(),
  changeLang: () => {},
  units: getUnits(),
  changeUnits: () => {},
})

export const useLang = () => useContext(LangContext)
