# The website is built and published from GitHub by Cloudflare Workers Builds, configured in
# frontend/wrangler.jsonc (static assets with a single-page-app fallback). Terraform describes the
# Worker itself, so the site's name, address and logging live in code too.
resource "cloudflare_worker" "frontend" {
  account_id = var.cloudflare_account_id
  name       = var.frontend_worker_name

  observability = {
    enabled = true
  }

  subdomain = {
    enabled = true
  }

  lifecycle {
    prevent_destroy = true
  }
}
