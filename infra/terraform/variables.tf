# ---------------------------------------------------------------------------
# Credentials. Never put real values in a file that is committed:
# use environment variables (TF_VAR_name) or a git-ignored terraform.tfvars.
# ---------------------------------------------------------------------------
variable "render_api_key" {
  description = "Render API key (Account Settings -> API Keys)."
  type        = string
  sensitive   = true
}

variable "render_owner_id" {
  description = "Render workspace id (starts with usr- or tea-; see the workspace settings URL)."
  type        = string
}

variable "supabase_access_token" {
  description = "Supabase personal access token (Account -> Access Tokens)."
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token that may edit Workers on this account."
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account id (Workers & Pages -> Account details)."
  type        = string
}

# ---------------------------------------------------------------------------
# What exists today (identifiers are not secrets).
# ---------------------------------------------------------------------------
variable "github_repo_url" {
  description = "Repository that Render builds the backend from."
  type        = string
  default     = "https://github.com/Zavada-Sofiia/Mealoria"
}

variable "supabase_project_ref" {
  description = "Reference of the Supabase project (the xxxx in https://xxxx.supabase.co)."
  type        = string
  default     = "vsvcffrxzeirzlaqozmo"
}

variable "site_url" {
  description = "Public address of the website; used for Supabase redirects and backend CORS."
  type        = string
  default     = "https://mealoria.zavada-sofia.workers.dev"
}

variable "render_region" {
  description = "Region of the Render service; check Settings -> Region in the Render dashboard."
  type        = string
  default     = "oregon"
}

variable "frontend_worker_name" {
  description = "Name of the Cloudflare Worker that serves the website."
  type        = string
  default     = "mealoria"
}

# ---------------------------------------------------------------------------
# Application settings passed to the backend as environment variables.
# ---------------------------------------------------------------------------
variable "supabase_publishable_key" {
  description = "Supabase publishable (anon) key. It is public by design, row level security protects data."
  type        = string
}

variable "gemini_api_key" {
  description = "Google AI Studio key for the AI assistant."
  type        = string
  sensitive   = true
}

variable "cf_images_api_token" {
  description = "Cloudflare token with the Workers AI permission, for AI dish photos (runs on the same account)."
  type        = string
  sensitive   = true
}

variable "sentry_dsn" {
  description = "Sentry DSN for the backend (an address, not a password); empty keeps error reporting off."
  type        = string
  default     = ""
}

variable "gemini_model" {
  description = "Pin a Gemini model; empty uses the backend default (gemini-flash-lite-latest)."
  type        = string
  default     = ""
}

# ---------------------------------------------------------------------------
# Supabase authentication settings.
# ---------------------------------------------------------------------------
variable "manage_supabase_project" {
  description = "Create and own the Supabase project itself. Leave false to only manage its auth settings."
  type        = bool
  default     = false
}

variable "supabase_organization_id" {
  description = "Only needed when manage_supabase_project is true."
  type        = string
  default     = ""
}

variable "supabase_region" {
  description = "Only needed when manage_supabase_project is true."
  type        = string
  default     = "eu-central-1"
}

variable "supabase_database_password" {
  description = "Only needed when manage_supabase_project is true."
  type        = string
  default     = ""
  sensitive   = true
}

variable "confirm_email" {
  description = "Require users to confirm their email before signing in."
  type        = bool
  default     = true
}

variable "google_client_id" {
  description = "Google OAuth client id (public). Empty leaves Google sign-in untouched."
  type        = string
  default     = ""
}

variable "google_client_secret" {
  description = "Google OAuth client secret."
  type        = string
  default     = ""
  sensitive   = true
}

variable "smtp_host" {
  description = "Custom SMTP host for auth emails (for example smtp.gmail.com); empty keeps Supabase's own sender."
  type        = string
  default     = ""
}

variable "smtp_port" {
  type    = number
  default = 465
}

variable "smtp_user" {
  type    = string
  default = ""
}

variable "smtp_password" {
  description = "SMTP password or Gmail app password."
  type        = string
  default     = ""
  sensitive   = true
}

variable "smtp_sender_name" {
  type    = string
  default = "Mealoria"
}
