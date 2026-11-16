import { Link } from 'react-router-dom'
import { CONTACT_EMAIL } from '../config'
import { getLang, t } from '../i18n'
import { usePageMeta } from '../seo'

const UPDATED = '11 листопада 2026'
const UPDATED_EN = '11 November 2026'
const PRIVACY_UPDATED = '16 листопада 2026'
const PRIVACY_UPDATED_EN = '16 November 2026'

function PrivacyUk() {
  return (
    <div className="legal">
      <h1>Політика конфіденційності</h1>
      <p className="muted">Оновлено: {PRIVACY_UPDATED}</p>
      <p>
        Mealoria — сервіс для планування харчування. Тут написано, які дані ми зберігаємо, навіщо і що
        ви можете з ними зробити.
      </p>

      <h2>Які дані ми зберігаємо</h2>
      <ul>
        <li>Email і спосіб входу (пароль або Google). Пароль зберігається лише у вигляді хешу, ми його не бачимо.</li>
        <li>
          Профіль, який ви заповнюєте самі: ім’я, прізвище, стать, вік, зріст, вага, активність, мета, тип харчування,
          алергени, кухні, час готування, бюджет, побажання. Це відомості про здоров’я, тому ми
          використовуємо їх лише для розрахунків і підбору рецептів.
        </li>
        <li>Ваші страви, фото страв, меню в календарі, список продуктів і продукти «вже є вдома».</li>
        <li>Журнал ваги й записи про воду, якщо ви їх ведете.</li>
        <li>Лічильники використання ШІ (скільки запитів за день), ваш тариф і промокоди, які ви активували.</li>
        <li>Позначку «передзамовив преміум», якщо ви натискали таку кнопку раніше (зараз передзамовлень немає).</li>
        <li>
          Замовлення на оплату преміуму: код замовлення, період, сума й час оплати. Дані вашої банківської картки ми не
          бачимо й не зберігаємо, переказ ви робите самі у своєму банку.
        </li>
        <li>
          Повідомлення, які ви надсилаєте через форму на сторінці «Допомога»: текст, вибрана тема, ваша пошта й час. Ми
          читаємо їх, щоб відповісти й покращити сервіс.
        </li>
      </ul>

      <h2>Кому ми передаємо дані</h2>
      <p>Ми не продаємо дані й не показуємо рекламу. Для роботи сервісу використовуються провайдери:</p>
      <ul>
        <li>Supabase: база даних, вхід і сховище фото.</li>
        <li>Cloudflare: хостинг сайту та створення ШІ-зображень страв (для преміуму).</li>
        <li>Render: сервер застосунку.</li>
        <li>
          Google (Gemini): ШІ-помічник. Для підбору рецептів йому надсилаються ваші вподобання й алергени (а для рецептів із холодильника ще й список продуктів, який ви вводите), для
          «калорій по фото» — саме фото страви. Email і ім’я не надсилаються.
        </li>
        <li>
          Open Food Facts: тільки назва продукту, яку ви шукаєте в калькуляторі, або штрихкод. Дані про товари
          з Open Food Facts поширюються за ліцензією ODbL; довідкові значення звичайних продуктів взято з USDA
          FoodData Central (суспільне надбання). Усі значення орієнтовні.
        </li>
        <li>Sentry: звіти про технічні помилки. Ми вимкнули збір email, cookie, заголовків і вмісту запитів.</li>
      </ul>
      <p>Ці провайдери можуть обробляти дані на серверах за межами України та ЄС.</p>

      <h2>Камера</h2>
      <p>
        Камера вмикається лише для сканера штрихкодів і лише з вашого дозволу. Зображення розпізнається у вашому
        браузері й нікуди не надсилається: на сервер іде тільки номер штрихкоду. Для «калорій по фото» ви самі
        обираєте або знімаєте фото, і саме воно надсилається в Gemini.
      </p>

      <h2>Cookie та аналітика</h2>
      <p>
        Ми не використовуємо рекламні cookie й аналітику. У браузері зберігається лише те, що потрібно для
        роботи: ваш вхід, мова, тема, одиниці виміру, кількість людей для порцій і останні ідеї з «Що
        приготувати». Єдина cookie, mealoria_rt, це запасна копія входу, щоб застосунок на телефоні не виходив
        з акаунта сам; вона зникає, коли ви натискаєте «Вийти».
      </p>

      <h2>Скільки зберігаємо</h2>
      <p>
        Доки у вас є акаунт. Після видалення акаунта ваші дані, фото й записи видаляються. Повідомлення з форми
        «Допомога» лишаються, але без вашої пошти й без зв’язку з акаунтом.
      </p>

      <h2>Ваші права</h2>
      <ul>
        <li>Редагувати профіль, страви й меню в самому застосунку.</li>
        <li>Видалити акаунт і всі дані: Профіль → «Видалити акаунт».</li>
        <li>
          Попросити копію своїх даних або задати питання: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </li>
      </ul>

      <h2>Діти</h2>
      <p>Сервіс призначений для осіб від 16 років.</p>

      <h2>Зміни</h2>
      <p>Якщо політика зміниться, ми оновимо дату зверху сторінки.</p>

      <p>
        <Link to="/terms">Умови користування</Link>
      </p>
    </div>
  )
}

function TermsUk() {
  return (
    <div className="legal">
      <h1>Умови користування</h1>
      <p className="muted">Оновлено: {UPDATED}</p>

      <h2>Про сервіс</h2>
      <p>
        Mealoria допомагає планувати меню, рахувати калорії й складати список продуктів. Користуючись
        сайтом, ви погоджуєтесь з цими умовами.
      </p>

      <h2>Не медична порада</h2>
      <p>
        Калорійність, норми й поради ШІ мають довідковий характер і можуть бути неточними. Сервіс не замінює
        консультацію лікаря чи дієтолога. Якщо у вас захворювання, вагітність чи харчова алергія, радьтеся
        зі спеціалістом і самі перевіряйте склад продуктів.
      </p>

      <h2>Акаунт</h2>
      <ul>
        <li>Ви відповідаєте за безпеку свого пароля й дані, які вводите.</li>
        <li>Не використовуйте сервіс для зловживань: масових запитів, спроб зламу, чужих даних.</li>
        <li>Ми можемо обмежити або закрити акаунт у разі порушення.</li>
      </ul>

      <h2>Ваш вміст</h2>
      <p>
        Страви, фото й тексти, які ви додаєте, залишаються вашими. Ви надаєте нам право зберігати й показувати
        їх вам у межах сервісу. Не завантажуйте фото й тексти, на які не маєте прав, і матеріали, що порушують
        закон.
      </p>

      <h2>Тарифи</h2>
      <p>
        Безкоштовний тариф має ліміти (кількість страв, запитів до ШІ, горизонт планування). Преміум розширює
        ліміти. Оплата поки не підключена: преміум видається вручну, а умови оплати ми повідомимо окремо до
        будь-якого списання коштів.
      </p>

      <h2>Доступність і відповідальність</h2>
      <p>
        Сервіс надається «як є». Він може бути тимчасово недоступний, а ШІ-функції залежать від зовнішніх
        провайдерів. У межах, дозволених законом, ми не відповідаємо за збитки від використання сервісу.
      </p>

      <h2>Зміни й зв’язок</h2>
      <p>
        Ми можемо оновлювати ці умови; дата зверху сторінки покаже, коли це було востаннє. Питання:{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
      <p>
        <Link to="/privacy">Політика конфіденційності</Link>
      </p>
    </div>
  )
}

function PrivacyEn() {
  return (
    <div className="legal">
      <h1>Privacy Policy</h1>
      <p className="muted">Updated: {PRIVACY_UPDATED_EN}</p>
      <p>
        Mealoria is a meal-planning service. This page explains which data we store, why, and what you
        can do with it.
      </p>

      <h2>What data we store</h2>
      <ul>
        <li>Your email and sign-in method (password or Google). The password is stored only as a hash; we cannot see it.</li>
        <li>
          The profile you fill in yourself: first and last name, sex, age, height, weight, activity, goal, diet, allergens,
          cuisines, cooking time, budget and wishes. This is health-related information, so we use it only
          for calculations and recipe suggestions.
        </li>
        <li>Your dishes, dish photos, calendar menu, shopping list and “already at home” products.</li>
        <li>Your weight journal and water entries, if you keep them.</li>
        <li>AI usage counters (how many requests per day), your plan and the promo codes you activated.</li>
        <li>A “pre-ordered Premium” flag, if you pressed that button earlier (pre-orders are no longer offered).</li>
        <li>
          Premium payment orders: the order code, period, amount and time of payment. We do not see or store your bank
          card details; you make the transfer yourself in your bank.
        </li>
        <li>
          Messages you send through the form on the Help page: the text, the chosen topic, your email and the time. We
          read them to reply and to improve the service.
        </li>
      </ul>

      <h2>Who we share data with</h2>
      <p>We do not sell data and we do not show ads. The service relies on these providers:</p>
      <ul>
        <li>Supabase: database, sign-in and photo storage.</li>
        <li>Cloudflare: website hosting and AI dish images (Premium).</li>
        <li>Render: the application server.</li>
        <li>
          Google (Gemini): the AI assistant. For recipe suggestions it receives your preferences and allergens (and, for fridge recipes, the list of products you enter);
          for “calories from a photo” it receives the photo of the dish. Your email and name are not sent.
        </li>
        <li>
          Open Food Facts: only the product name or barcode you search for in the calculator. Product data from
          Open Food Facts is available under the ODbL; reference values for everyday products come from USDA
          FoodData Central (public domain). All values are approximate.
        </li>
        <li>Sentry: technical error reports. We have disabled collection of email, cookies, headers and request contents.</li>
      </ul>
      <p>These providers may process data on servers outside Ukraine and the EU.</p>

      <h2>Camera</h2>
      <p>
        The camera turns on only for the barcode scanner and only with your permission. The image is read in your
        browser and is not sent anywhere: only the barcode number goes to the server. For “calories from a photo”
        you choose or take the photo yourself, and that photo is sent to Gemini.
      </p>

      <h2>Cookies and analytics</h2>
      <p>
        We use no advertising cookies and no analytics. Your browser stores only what is needed for the site to
        work: your sign-in, language, theme, units, the number of people for servings and the latest ideas from
        “What to cook”. The only cookie, mealoria_rt, is a backup of your sign-in so that the app on your phone
        does not sign you out by itself; it is removed when you press “Sign out”.
      </p>

      <h2>How long we keep it</h2>
      <p>
        For as long as you have an account. After you delete the account, your data, photos and entries are deleted.
        Messages from the Help form are kept, but without your email and without any link to the account.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li>Edit your profile, dishes and menu in the app itself.</li>
        <li>Delete your account and all data: Profile → “Delete account”.</li>
        <li>
          Ask for a copy of your data or ask a question: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </li>
      </ul>

      <h2>Children</h2>
      <p>The service is intended for people aged 16 and over.</p>

      <h2>Changes</h2>
      <p>If the policy changes, we will update the date at the top of this page.</p>

      <p>
        <Link to="/terms">Terms of Use</Link>
      </p>
    </div>
  )
}

function TermsEn() {
  return (
    <div className="legal">
      <h1>Terms of Use</h1>
      <p className="muted">Updated: {UPDATED_EN}</p>

      <h2>About the service</h2>
      <p>
        Mealoria helps you plan menus, count calories and build a shopping list. By using the site you
        agree to these terms.
      </p>

      <h2>Not medical advice</h2>
      <p>
        Calorie values, norms and AI advice are for reference only and may be inaccurate. The service does not replace
        a consultation with a doctor or dietitian. If you have a medical condition, are pregnant or have a food
        allergy, consult a specialist and check product ingredients yourself.
      </p>

      <h2>Account</h2>
      <ul>
        <li>You are responsible for the security of your password and for the data you enter.</li>
        <li>Do not use the service for abuse: mass requests, hacking attempts, other people’s data.</li>
        <li>We may restrict or close an account in case of violations.</li>
      </ul>

      <h2>Your content</h2>
      <p>
        Dishes, photos and texts you add remain yours. You grant us the right to store them and show them to you
        within the service. Do not upload photos or texts you have no rights to, or material that breaks the law.
      </p>

      <h2>Plans</h2>
      <p>
        The free plan has limits (number of dishes, AI requests, planning horizon). Premium raises the limits.
        Payments are not connected yet: Premium is granted manually, and we will announce the payment terms separately
        before charging any money.
      </p>

      <h2>Availability and liability</h2>
      <p>
        The service is provided “as is”. It may be temporarily unavailable, and AI features depend on external
        providers. To the extent permitted by law, we are not liable for damages from using the service.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We may update these terms; the date at the top of the page shows when this last happened. Questions:{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
      <p>
        <Link to="/privacy">Privacy Policy</Link>
      </p>
    </div>
  )
}

export function Privacy() {
  usePageMeta(t('Політика конфіденційності Mealoria'), t('Які дані зберігає Mealoria, кому їх передає та як ви можете їх видалити.'))
  return getLang() === 'en' ? <PrivacyEn /> : <PrivacyUk />
}

export function Terms() {
  usePageMeta(t('Умови користування Mealoria'), t('Умови користування сервісом Mealoria: акаунт, ваш вміст, тарифи та відповідальність.'))
  return getLang() === 'en' ? <TermsEn /> : <TermsUk />
}
