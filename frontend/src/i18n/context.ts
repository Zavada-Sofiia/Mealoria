import { createContext, useContext } from 'react'
import { getLang, type Lang } from '.'
import { getDateFormat, getEnergy, getUnits, type DateFormat, type Energy, type Units } from '../units'

export const LangContext = createContext<{
  lang: Lang
  changeLang: (l: Lang) => void
  units: Units
  changeUnits: (u: Units) => void
  energy: Energy
  changeEnergy: (e: Energy) => void
  dateFormat: DateFormat
  changeDateFormat: (f: DateFormat) => void
}>({
  lang: getLang(),
  changeLang: () => {},
  units: getUnits(),
  changeUnits: () => {},
  energy: getEnergy(),
  changeEnergy: () => {},
  dateFormat: getDateFormat(),
  changeDateFormat: () => {},
})

export const useLang = () => useContext(LangContext)
