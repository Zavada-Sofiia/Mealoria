# Інфраструктура кодом (Terraform)

Тут описано, з чого складається Mealoria в хмарі, щоб це можна було перечитати, перевірити й за потреби
відтворити.

| Частина | Сервіс | Файл | Що описано |
| --- | --- | --- | --- |
| Бекенд (FastAPI) | Render, безкоштовний тариф | `render.tf` | сервіс, збірка й запуск, перевірка здоров'я, змінні середовища (ключі) |
| Вхід і база | Supabase | `supabase.tf` | налаштування авторизації: адреси, Google-вхід, підтвердження пошти, власний SMTP |
| Сайт | Cloudflare Workers | `cloudflare.tf` | Worker сайту. Збірку з GitHub робить Cloudflare за `frontend/wrangler.jsonc` |

Схема бази, політики доступу й сховище лежать у SQL-міграціях `../supabase/` (їх Terraform не чіпає).

## Безпечні налаштування за замовчуванням

- Terraform **не створює** проєкт Supabase, поки ви явно не ввімкнете `manage_supabase_project = true`.
  За замовчуванням він лише керує його налаштуваннями авторизації.
- Усі основні ресурси мають `prevent_destroy`: випадково видалити робочий бекенд чи сайт неможливо.
- Секрети в коді відсутні. Вони передаються змінними `TF_VAR_...` або файлом `terraform.tfvars`, який
  ігнорується git. У `.gitignore` також файли стану (`*.tfstate*`).

## Перевірка без доступу до акаунтів

```bash
cd infra/terraform
terraform init -backend=false
terraform fmt -check -recursive
terraform validate
```

Те саме робить CI на кожен пуш (`.github/workflows/ci.yml`, завдання `infra`).

## Як перейняти наявну інфраструктуру (імпорт)

Сервіси вже працюють, тому спершу їх треба **імпортувати** у стан Terraform, інакше він спробує створити
дублікати.

1. Створіть токени: Render (Account Settings → API Keys), Supabase (Account → Access Tokens), Cloudflare
   (токен із правом редагувати Workers).
2. `cp terraform.tfvars.example terraform.tfvars` і заповніть значення.
3. `terraform init`
4. Імпорт:
   ```bash
   terraform import render_web_service.backend srv-dbppg556e07s73b2soj0
   terraform import supabase_settings.main vsvcffrxzeirzlaqozmo
   terraform import cloudflare_worker.frontend "<cloudflare_account_id>/mealoria"
   ```
5. `terraform plan` і **уважно прочитайте різницю**. Очікувані зміни: нова перевірка здоров'я бекенду
   (`/api/health`), значення змінних середовища, налаштування авторизації. Якщо щось дивне, не застосовуйте.
6. `terraform apply`, коли різниця зрозуміла.

## Що перевірено, а що ні

Перевірено: схема ресурсів відповідає провайдерам (`validate`), вирази обчислюються (`plan` на порожньому
стані з фальшивими значеннями), форматування (`fmt`).

**Не перевірено на реальних акаунтах** (потрібні ваші токени): сам імпорт і `apply`. Особливо варто
звірити: ідентифікатор для імпорту Cloudflare Worker (формат залежить від версії провайдера), регіон Render
(`render_region`) і те, що тариф `free` провайдер Render не змінює (для цього стоїть `ignore_changes = [plan]`).

## Зберігання стану

Файл стану містить значення секретів, тому він **не повинен потрапляти в репозиторій**. Для команди з двох
людей зручно зберігати стан віддалено (наприклад, у Terraform Cloud) або передавати його між собою
захищеним способом.
