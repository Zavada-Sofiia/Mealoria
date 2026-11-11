locals {
  project_ref = var.manage_supabase_project ? supabase_project.main[0].id : var.supabase_project_ref

  auth_settings = merge(
    {
      site_url           = var.site_url
      uri_allow_list     = "${var.site_url},${var.site_url}/**,http://localhost:5173/**"
      mailer_autoconfirm = !var.confirm_email
      disable_signup     = false
    },
    var.google_client_id == "" ? {} : {
      external_google_enabled   = true
      external_google_client_id = var.google_client_id
      external_google_secret    = var.google_client_secret
    },
    var.smtp_host == "" ? {} : {
      smtp_host        = var.smtp_host
      smtp_port        = tostring(var.smtp_port)
      smtp_user        = var.smtp_user
      smtp_pass        = var.smtp_password
      smtp_admin_email = var.smtp_user
      smtp_sender_name = var.smtp_sender_name
    },
  )
}

# The project itself is only managed when explicitly asked for. By default the existing project
# is left alone, so a mistake here can never touch the production database.
resource "supabase_project" "main" {
  count = var.manage_supabase_project ? 1 : 0

  name              = "Mealoria"
  organization_id   = var.supabase_organization_id
  region            = var.supabase_region
  database_password = var.supabase_database_password

  lifecycle {
    prevent_destroy = true
    # The password cannot be read back after an import.
    ignore_changes = [database_password]
  }
}

# Authentication settings (redirect addresses, Google sign-in, email confirmation, SMTP).
# The database schema, policies and storage are SQL migrations in ../supabase.
resource "supabase_settings" "main" {
  project_ref = local.project_ref

  auth = jsonencode(local.auth_settings)
}
