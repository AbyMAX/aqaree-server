require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db/pool');

const app = express();
const PORT = process.env.PORT || 8000;

// CORS: reflect the caller origin (web dev server, production domain,
// Android/iOS WebViews). Auth uses Bearer tokens (no cookies), so there is
// no CSRF surface and no origin allow-list to maintain.
// Behind Render's reverse proxy: trust it for correct client IPs
// (rate limiting and logging depend on this).
app.set('trust proxy', 1);
app.use(cors({ origin: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'aqaree-server', time: new Date().toISOString(), commit: String(process.env.RENDER_GIT_COMMIT || 'local').slice(0, 7) });
});

// Step 6+: real routes mount here (auth, properties, favorites, ...)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/properties', require('./routes/properties'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/users', require('./routes/users'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api', require('./routes/content'));

// Admin control panel (single page; the API enforces admin rights).
app.get('/admin', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'admin.html'));
});

// Public privacy policy (required by Google Play). Arabic-first, RTL,
// with an English section below. Keep in sync with actual data practices:
// email/phone, listing content & photos, location, device push tokens.
app.get('/privacy', (req, res) => {
  const updatedAt = '2026-10-28';
  const contact = 'aqaree.sd@gmail.com';
  res.send(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>سياسة الخصوصية — عقاري | Privacy Policy — Aqaree</title><style>body{margin:0;font-family:system-ui,'Segoe UI',Tahoma,sans-serif;background:#ffffff;color:#131316;line-height:1.8}main{max-width:720px;margin:0 auto;padding:32px 20px 64px}h1{font-size:26px;margin:0 0 4px}h2{font-size:19px;margin:32px 0 8px}p,li{font-size:15px;color:#3f3f46}ul{padding-inline-start:22px}small{color:#71717a}hr{border:0;border-top:1px solid #e4e4e7;margin:32px 0}.en{direction:ltr;text-align:left}.en h2,.en p,.en li{color:#3f3f46}.brand{display:inline-block;background:#1D4ED8;color:#fff;font-weight:700;padding:4px 12px;border-radius:10px;margin-bottom:12px}</style></head><body><main>
<h1>سياسة الخصوصية <small>(آخر تحديث: ${updatedAt})</small></h1>
<p><span class="brand">عقاري</span> هو تطبيق لعرض وإدارة العقارات في السودان. نحترم خصوصيتك ونجمع أقل قدر ممكن من البيانات.</p>

<h2>١. البيانات التي نجمعها</h2>
<ul>
<li><b>بيانات الحساب:</b> الاسم، البريد الإلكتروني، رقم الهاتف، رقم واتساب (للتواصل بين البائع والمشتري).</li>
<li><b>محتوى الإعلانات:</b> عنوان العقار، الوصف، الموقع، السعر، عدد الغرف والحمامات، الخصائص (مثل المكيف)، والصور التي ترفعها.</li>
<li><b>الموقع الجغرافي:</b> إحداثيات العقار التي تحددها بنفسك على الخريطة (لا نجمع موقعك الحالي تلقائياً).</li>
<li><b>بيانات الجهاز:</b> رمز الإشعارات (Push Token) لإرسال إشعارات مثل تفاعل المستخدمين مع إعلانك.</li>
<li><b>بيانات الدخول عبر جوجل:</b> إذا سجلت الدخول بجوجل، نستخدم الاسم والبريد وصورة الحساب فقط.</li>
</ul>

<h2>٢. كيف نستخدم البيانات</h2>
<ul>
<li>تشغيل الخدمة: عرض إعلاناتك، إدارة المفضلة، وحفظ إعداداتك (اللغة، العملة).</li>
<li>إرسال رمز التحقق (OTP) إلى بريدك عند تسجيل الدخول، عبر مزود البريد Brevo.</li>
<li>إرسال إشعارات فورية عبر Firebase Cloud Messaging.</li>
<li>تحسين الخدمة ومراجعة الإعلانات قبل نشرها (الإشراف).</li>
</ul>

<h2>٣. مشاركة البيانات مع أطراف ثالثة</h2>
<ul>
<li><b>Neon:</b> استضافة قاعدة البيانات.</li>
<li><b>Cloudinary:</b> تخزين صور الإعلانات.</li>
<li><b>Brevo:</b> إرسال رسائل رمز التحقق.</li>
<li><b>Firebase (Google):</b> الإشعارات وتسجيل الدخول بجوجل.</li>
<li>لا نبيع بياناتك لأي جهة، ولا نستخدمها للإعلانات.</li>
</ul>

<h2>٤. مدة الاحتفاظ بالبيانات</h2>
<p>نحتفظ ببياناتك طالما حسابك نشط. عند حذف حسابك من داخل التطبيق (الملف الشخصي ← حذف الحساب) تُحذف نهائياً: إعلاناتك وصورها، مفضلاتك، إشعاراتك، ورموز إشعارات جهازك.</p>

<h2>٥. حقوقك</h2>
<ul>
<li>يمكنك حذف حسابك وبياناتك بالكامل من داخل التطبيق في أي وقت.</li>
<li>يمكنك طلب تصحيح بياناتك (الاسم/الهاتف) من صفحة الملف الشخصي.</li>
<li>للاستفسارات أو طلبات الخصوصية: <b>${contact}</b></li>
</ul>

<h2>٦. الأطفال</h2>
<p>الخدمة موجهة للبالغين (18+) ولا نجمع بيانات الأطفال عمداً.</p>

<hr>
<div class="en">
<h1>Privacy Policy <small>(updated: ${updatedAt})</small></h1>
<h2>1. Data we collect</h2>
<ul>
<li><b>Account:</b> name, email, phone number, WhatsApp number (used to connect buyers and sellers).</li>
<li><b>Listing content:</b> title, description, location, price, rooms, amenities and the photos you upload.</li>
<li><b>Location:</b> the property coordinates you pick on the map. We never collect your live location.</li>
<li><b>Device:</b> push notification token (for notifications such as activity on your listing).</li>
<li><b>Google sign-in:</b> if you use Google, we receive your name, email and profile picture only.</li>
</ul>
<h2>2. How we use data</h2>
<ul><li>To run the service: showing listings, favorites, and your preferences.</li><li>To email your one-time login code (via Brevo).</li><li>To deliver push notifications (via Firebase Cloud Messaging).</li><li>To moderate listings before they appear.</li></ul>
<h2>3. Third parties</h2>
<ul><li><b>Neon</b> (database), <b>Cloudinary</b> (photos), <b>Brevo</b> (email codes), <b>Firebase / Google</b> (auth &amp; push).</li><li>We never sell your data or use it for advertising.</li></ul>
<h2>4. Retention &amp; deletion</h2>
<p>Data is kept while your account is active. Deleting your account in-app (Profile → Delete Account) permanently removes your listings and their photos, favorites, notifications and device tokens.</p>
<h2>5. Your rights &amp; contact</h2>
<ul><li>Delete your account and data anytime from inside the app.</li><li>Correct your profile data from the Profile page.</li><li>Questions: <b>${contact}</b></li></ul>
</div>
</main></body></html>`);
});

// Android App Link verification for shared listing URLs.
app.get('/.well-known/assetlinks.json', (req, res) => {
  res.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.aqaree.app',
        sha256_cert_fingerprints: [
          // Debug keystore
          '9D:A9:EF:EF:D8:93:98:43:7A:48:C3:04:96:58:AA:F5:18:0E:33:99:E1:13:9C:B5:98:A5:FB:44:9C:D6:69:64',
          // Release upload keystore (aqaree-release.keystore)
          'CC:AF:EB:83:F6:52:C4:A7:00:3F:BB:90:FC:6C:84:1A:95:74:80:F7:80:6F:E4:97:B1:B1:F2:5E:80:F5:CD:97',
        ],
      },
    },
  ]);
});

function escHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Shared listing landing page: opens the listing in the app when tapped
// on Android, shows a preview otherwise.
const { publicLimiter } = require('./rateLimit');
app.get('/property/:id', publicLimiter, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, title, location, price, currency, images FROM properties WHERE id = $1',
      [req.params.id]
    );
    const p = rows[0];
    if (!p) return res.status(404).send('Listing not found');
    const title = escHtml(p.title || 'Property');
    const loc = escHtml(p.location || '');
    const price = escHtml(`${Number(p.price) || 0} ${p.currency || 'SDG'}`);
    const img = Array.isArray(p.images) && p.images[0] ? escHtml(p.images[0]) : '';
    res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Aqaree</title></head><body style="margin:0;font-family:system-ui;background:#131316;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box"><div style="max-width:420px;width:100%;text-align:center">${img ? `<img src="${img}" alt="" style="width:100%;border-radius:16px;object-fit:cover;max-height:300px">` : ''}<h1 style="font-size:22px;margin:20px 0 6px">${title}</h1><p style="color:#9A9AA5;margin:0">${loc}</p><p style="font-size:20px;font-weight:700;margin:12px 0 24px">${price}</p><a href="aqaree://property/${p.id}" style="display:block;background:#1D4ED8;color:#fff;text-decoration:none;padding:16px;border-radius:12px;font-weight:700">Open in Aqaree app</a><p style="color:#9A9AA5;font-size:13px;margin-top:16px">افتح الإعلان في تطبيق عقاري</p></div></body></html>`);
  } catch (err) {
    console.error('property landing:', err.message);
    res.status(500).send('Could not load listing');
  }
});

app.use((req, res) => res.status(404).json({ message: 'Not found' }));

// Seed demo catalog on boot when tables are empty (safe to run always).
if (process.env.DATABASE_URL) {
  const { seedIfEmpty } = require('./db/seed');
  seedIfEmpty().catch((err) => console.error('seed:', err.message));

  // Idempotent boot-time schema for the Aqaree Admin app (migrate11):
  // last-login tracking + admin push devices. Runs on every deploy; the
  // IF NOT EXISTS guards make it free after the first time.
  (async () => {
    try {
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ');
      await pool.query(`CREATE TABLE IF NOT EXISTS admin_devices (
        token      TEXT PRIMARY KEY,
        platform   TEXT NOT NULL DEFAULT 'android',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      console.log('admin schema: ok');
    } catch (err) {
      console.error('admin schema:', err.message);
    }
  })();
}

app.use((req, res) => res.status(404).json({ message: 'Not found' }));

app.listen(PORT, () => {
  console.log(`aqaree-server listening on :${PORT}`);
});
