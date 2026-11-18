// The site itself is static files; this tiny Worker only sends http:// visitors to https:// and adds a timer.
// Render's free server falls asleep after 15 minutes without requests and then needs 30–60 s to wake up,
// so every 10 minutes it gets a light request and stays awake for the people using the site.
const LOCAL = ['localhost', '127.0.0.1']

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.protocol === 'http:' && !LOCAL.includes(url.hostname)) {
      url.protocol = 'https:'
      return Response.redirect(url.toString(), 301)
    }
    return env.ASSETS.fetch(request)
  },
  async scheduled(_controller, _env, ctx) {
    ctx.waitUntil(
      fetch('https://mealoria.onrender.com/api/health', { headers: { 'User-Agent': 'Mealoria keep-warm' } }).catch(() => {}),
    )
  },
}
