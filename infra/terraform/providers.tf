provider "render" {
  api_key  = var.render_api_key
  owner_id = var.render_owner_id
}

provider "supabase" {
  access_token = var.supabase_access_token
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
