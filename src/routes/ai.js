const express = require('express');
const { requireAuth } = require('../auth');
const { publicLimiter } = require('../rateLimit');

const router = express.Router();

// AI listing description generator. Free/cheap path: Google Gemini
// (GEMINI_API_KEY on Render). Without a key we fall back to a clean
//Arabic template so the button always produces something useful.
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';

const TYPE_AR = {
  Apartment: 'شقة', House: 'منزل', Condo: 'شقة فندقية', Villa: 'فيلا',
  Townhouse: 'تاون هاوس', Duplex: 'دوبلكس', Penthouse: 'بنتهاوس',
  Studio: 'استوديو', Chalet: 'شاليه', Office: 'مكتب', Shop: 'محل',
  Warehouse: 'مخزن', Land: 'أرض', Farm: 'مزرعة',
};
const AMEN_AR = {
  TV: 'شاشة', Wifi: 'واي فاي', Stove: 'بوتاجاز', AC: 'مكيف هواء',
  Heater: 'سخان', Oven: 'فرن', Dishwasher: 'غسالة أطباق', Referigerator: 'ثلاجة',
  Refrigerator: 'ثلاجة', Parking: 'موقف سيارات', Elevator: 'مصعد',
};

const amenAr = (a) => {
  if (typeof a !== 'string') return '';
  return AMEN_AR[a] || (a.length <= 24 ? a : '');
};

function templateDesc(b) {
  const type = TYPE_AR[b.propertyType] || 'عقار';
  const parts = [];
  parts.push(`${b.listingType === 'Sell' ? 'للبيع' : 'للإيجار'}: ${type} بمساحة ${b.size || '—'} م².`);
  const loc = [b.state, b.locality, b.neighborhood].filter(Boolean).join(' - ');
  if (loc) parts.push(`الموقع: ${loc}.`);
  const rooms = [];
  if (b.bedrooms) rooms.push(`${b.bedrooms} غرف نوم`);
  if (b.bathrooms) rooms.push(`${b.bathrooms} حمامات`);
  if (b.floor) rooms.push(`طابق ${b.floor}`);
  if (rooms.length) parts.push(`يحتوي على ${rooms.join('، ')}.`);
  const ams = (Array.isArray(b.amenities) ? b.amenities : []).map(amenAr).filter(Boolean);
  if (ams.length) parts.push(`مميزات: ${ams.join('، ')}.`);
  if (b.price) parts.push(`السعر: ${b.price} ${b.currency === 'USD' ? 'دولار' : 'جنيه'}${b.listingType === 'Rent' ? ' شهرياً' : ''}.`);
  parts.push('جاهز للتفاوض، التواصل لمشاهدة العقار.');
  return parts.join(' ');
}

function extractText(gem) {
  try {
    const parts = gem?.candidates?.[0]?.content?.parts || [];
    return parts.map((p) => p.text || '').join('').trim();
  } catch {
    return '';
  }
}

// POST /api/ai/description  { lang, listingType, propertyType, size, price,
//   currency, state, locality, neighborhood, bedrooms, bathrooms, floor,
//   amenities }
router.post('/description', requireAuth, publicLimiter, async (req, res) => {
  const b = req.body || {};
  const lang = b.lang === 'en' ? 'en' : 'ar';
  const labels = (lang === 'ar' ? TYPE_AR : null) || {};
  const type = lang === 'ar' ? (labels[b.propertyType] || b.propertyType || 'عقار') : (b.propertyType || 'property');

  if (!GEMINI_KEY) {
    const text = templateDesc(b);
    return res.json({ description: text, source: 'template' });
  }

  const prompt =
    lang === 'ar'
      ? `أنت كاتب إعلانات عقارات سوداني محترف. اكتب وصفاً قصيراً وجاذبياً (سطران إلى ثلاثة أسطر) لإعلان عقاري بالعربية الفصحى البسيطة. لا تستخدم رموزاً تعبيرية ولا نقاط قائمة.
البيانات: النوع: ${type}. الغرض: ${b.listingType === 'Sell' ? 'بيع' : 'إيجار'}. المساحة: ${b.size || 'غير محددة'} م². السعر: ${b.price || 'غير محدد'} ${b.currency === 'USD' ? 'دولار' : 'جنيه سوداني'}${b.listingType === 'Rent' ? ' شهرياً' : ''}. الموقع: ${[b.state, b.locality, b.neighborhood].filter(Boolean).join(' - ') || 'غير محدد'}. الغرف: ${b.bedrooms || '—'}. الحمامات: ${b.bathrooms || '—'}. الطابق: ${b.floor || '—'}. المميزات: ${(Array.isArray(b.amenities) ? b.amenities : []).map(amenAr).filter(Boolean).join('، ') || '—'}.
اكتب الوصف فقط دون مقدمات.`
      : `You write real-estate listing descriptions for Sudan. Write a short, warm 2-3 sentence listing description. No emojis, no bullet points. Data: type ${type}; purpose ${b.listingType}; size ${b.size || '?'} sqm; price ${b.price || '?'} ${b.currency}; location ${[b.state, b.locality, b.neighborhood].filter(Boolean).join(' - ')}; bedrooms ${b.bedrooms || '?'}; bathrooms ${b.bathrooms || '?'}; floor ${b.floor || '?'}; amenities: ${(Array.isArray(b.amenities) ? b.amenities : []).join(', ')}. Output the description only.`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
        }),
      }
    );
    if (!r.ok) throw new Error(`gemini ${r.status}`);
    const j = await r.json();
    const text = extractText(j);
    if (!text) throw new Error('empty');
    return res.json({ description: text, source: 'ai' });
  } catch (err) {
    console.error('ai description:', err.message);
    return res.json({ description: templateDesc(b), source: 'template' });
  }
});

module.exports = router;
