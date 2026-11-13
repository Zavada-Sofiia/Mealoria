# Шаблони листів Supabase

Листи, які Supabase надсилає від імені сайту: підтвердження пошти, скидання пароля тощо.
Кожен лист двомовний (українська, нижче англійська) і оформлений у кольорах Mealoria.

## Як підключити

Supabase → **Authentication → Emails → Templates** (у старому інтерфейсі **Authentication → Email Templates**).
Для кожного листа відкрийте його вкладку, вставте тему та вміст файлу цілком у поле **Message body** (режим HTML/Source) і збережіть.

| Вкладка Supabase | Файл | Тема листа |
|---|---|---|
| Confirm sign up | `confirm-signup.html` | Підтвердіть пошту · Confirm your email |
| Reset password | `reset-password.html` | Скидання пароля · Reset your password |
| Magic link | `magic-link.html` | Вхід у Mealoria · Sign in to Mealoria |
| Change email address | `change-email.html` | Підтвердіть нову пошту · Confirm your new email |
| Invite user | `invite.html` | Вас запросили до Mealoria · You are invited to Mealoria |
| Reauthentication | `reauthentication.html` | Код підтвердження · Confirmation code |

У шаблонах використані змінні Supabase (`{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`, `{{ .Token }}`), їх змінювати не треба.
Логотип підтягується з `https://mealoria.mealoria.workers.dev/icon-192.png`. Якщо зміниться адреса сайту, замініть її у файлах.

## Підтвердження пошти кодом

Лист «Confirm sign up» містить 6-значний код (`{{ .Token }}`) замість кнопки-посилання. Сайт після реєстрації
показує поле для коду. У Supabase → **Authentication → Sign In / Providers → Email** довжина коду
(**Email OTP Length**) має бути **6**, термін дії (**Email OTP Expiration**) 3600 секунд.

## Обмеження

Вбудована пошта Supabase обмежена кількома листами на годину й може потрапляти в спам. Для більшого обсягу підключіть
власний SMTP (**Authentication → Emails → SMTP Settings**) і вкажіть відправника на кшталт `Mealoria`.
