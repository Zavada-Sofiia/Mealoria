// The site itself is static files; this tiny Worker only adds a timer.
// Render's free server falls asleep after 15 minutes without requests and then needs 30–60 s to wake up,
// so every 10 minutes it gets a light request and stays awake for the people using the site.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request)
  },
  async scheduled(_controller, _env, ctx) {
    ctx.waitUntil(
      fetch('https://mealoria.onrender.com/api/health', { headers: { 'User-Agent': 'Mealoria keep-warm' } }).catch(() => {}),
    )
  },
}
