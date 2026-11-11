# Backend (FastAPI) on Render's free plan.
# Adopt the existing service instead of creating a new one: see README.md ("Import").
resource "render_web_service" "backend" {
  name   = "Mealoria"
  plan   = "free"
  region = var.render_region

  root_directory    = "backend"
  start_command     = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
  health_check_path = "/api/health"

  runtime_source = {
    native_runtime = {
      repo_url      = var.github_repo_url
      branch        = "main"
      build_command = "pip install ."
      runtime       = "python"
      auto_deploy   = true
    }
  }

  env_vars = merge(
    {
      SUPABASE_URL             = { value = "https://${var.supabase_project_ref}.supabase.co" }
      SUPABASE_PUBLISHABLE_KEY = { value = var.supabase_publishable_key }
      GEMINI_API_KEY           = { value = var.gemini_api_key }
      CF_ACCOUNT_ID            = { value = var.cloudflare_account_id }
      CF_API_TOKEN             = { value = var.cf_images_api_token }
      CORS_ORIGINS             = { value = "${var.site_url},http://localhost:5173" }
    },
    var.gemini_model == "" ? {} : { GEMINI_MODEL = { value = var.gemini_model } },
  )

  lifecycle {
    # Never delete the production backend by accident.
    prevent_destroy = true
    # The provider documents paid plans only; do not let it try to change the free one.
    ignore_changes = [plan]
  }
}
