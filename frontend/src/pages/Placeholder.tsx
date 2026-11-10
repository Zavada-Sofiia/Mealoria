import { supabase } from '../api/supabase'

export default function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1>{title}</h1>
      <button onClick={() => supabase.auth.signOut()}>Вийти</button>
    </div>
  )
}
