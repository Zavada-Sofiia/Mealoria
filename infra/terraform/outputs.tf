output "backend_url" {
  description = "Public address of the backend API."
  value       = render_web_service.backend.url
}

output "supabase_url" {
  description = "Supabase project address."
  value       = "https://${local.project_ref}.supabase.co"
}

output "site_url" {
  description = "Public address of the website."
  value       = var.site_url
}
