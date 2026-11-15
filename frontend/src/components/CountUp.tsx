import { useCountUp } from '../useCountUp'

/** A number that glides to its value. Only this small piece re-renders on each frame, not the whole page. */
export default function CountUp({ value }: { value: number }) {
  return <>{Math.round(useCountUp(value))}</>
}
