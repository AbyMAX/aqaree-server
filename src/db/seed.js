// One-time demo seed: fills news, faqs and the 6 demo properties the app
// ships with, so the backend serves a full catalog from the first request.
// Runs automatically on boot ONLY when those tables are empty.
const pool = require('./pool');

const DEMO_PROPERTIES = [
  {
    title: 'Citi Smart Sukhumvit 18', title_ar: 'سيتي سمارت سوخومفيت 18',
    location: 'Phrom Phong, Bangkok', location_ar: 'بروم فونغ، بانكوك',
    description: 'A modern 2-bedroom condo in the heart of Phrom Phong, steps from the BTS station, malls, and restaurants.',
    description_ar: 'شقة فندقية حديثة بغرفتي نوم في قلب بروم فونغ، على بعد خطوات من محطة القطار والمراكز التجارية والمطاعم.',
    price: 1200, currency: 'SDG', type: 'Condo', beds: 2, baths: 1,
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
    ],
  },
  {
    title: 'The Waterford Rama 4', title_ar: 'ووترفورد راما 4',
    location: 'Phra Khanong Tai, Bangkok', location_ar: 'فرا خانونغ تاي، بانكوك',
    description: 'A cozy 2-bedroom unit with pool, garden and 24-hour security, close to international schools.',
    description_ar: 'وحدة مريحة بغرفتي نوم مع مسبح وحديقة وأمن على مدار الساعة، بالقرب من المدارس الدولية.',
    price: 900, currency: 'SDG', type: 'Condo', beds: 2, baths: 1,
    images: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
    ],
  },
  {
    title: 'Skyview Residence 40', title_ar: 'سكاي فيو ريزيدنس 40',
    location: 'Phrom Phong, Bangkok', location_ar: 'بروم فونغ، بانكوك',
    description: 'An opulent residence with skyline views and modern interiors along Sukhumvit Road.',
    description_ar: 'مسكن فاخر بإطلالات على أفق المدينة وتصاميم داخلية عصرية على طريق سوخومفيت.',
    price: 1200, currency: 'SDG', type: 'Condo', beds: 2, baths: 1,
    images: [
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
    ],
  },
  {
    title: 'Marakesh Residence', title_ar: 'مراكش ريزيدنس',
    location: 'Nong Kae, Prachuap Khiri Khan', location_ar: 'نونغ كاي، براتشواب خيري خان',
    description: 'A spacious 3-bedroom residence with sea breeze, large balcony and parking for two cars.',
    description_ar: 'مسكن واسع بثلاث غرف نوم مع نسيم البحر وشرفة كبيرة وموقف لسيارتين.',
    price: 1500, currency: 'SDG', type: 'Condo', beds: 3, baths: 2,
    images: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
    ],
  },
  {
    title: 'The Deck Patong', title_ar: 'ذا ديك باتونغ',
    location: 'Pa Tong, Phuket', location_ar: 'با تونغ، بوكيت',
    description: 'A stylish 1-bedroom apartment minutes from Patong beach with a sunny deck.',
    description_ar: 'شقة أنيقة بغرفة نوم واحدة على بعد دقائق من شاطئ باتونغ مع شرفة مشمسة.',
    price: 850, currency: 'SDG', type: 'Apartment', beds: 1, baths: 1,
    images: [
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
    ],
  },
  {
    title: 'Emerald Bay Towers', title_ar: 'أبراج الخليج الزمردي',
    location: 'Phrom Phong, Bangkok', location_ar: 'بروم فونغ، بانكوك',
    description: 'A high-floor 2-bedroom tower unit with panoramic views, gym, sauna and infinity pool.',
    description_ar: 'وحدة برجية بغرفتي نوم في طابق مرتفع بإطلالات بانورامية مع صالة رياضية وساونا ومسبح.',
    price: 1200, currency: 'SDG', type: 'Condo', beds: 2, baths: 1,
    images: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
    ],
  },
];

const DEMO_NEWS = [
  {
    title: 'Creative Ideas for Personalizing Your Temporary Home', date_text: '21 Dec 2023',
    author: 'Gracia', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
    body: 'Renting a home does not mean you cannot make it feel like your own. From removable wallpaper to modular furniture, there are countless renter-friendly ways to personalize your space without risking your deposit.',
  },
  {
    title: 'Understanding the Property Buying Process for Beginners', date_text: '21 Dec 2023',
    author: 'Gracia', image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
    body: 'Buying your first property can feel overwhelming. Start with budgeting and pre-approval, shortlist locations, view units, make an offer, and complete the legal transfer.',
  },
  {
    title: 'What You Need to Know Before Buying or Renting', date_text: '21 Dec 2023',
    author: 'Gracia', image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800',
    body: 'Renting offers flexibility and lower upfront cost, while buying builds equity over time. Compare mortgage payments against rent in your target area before committing.',
  },
  {
    title: 'How Eco-Friendly Features Can Enhance Your Property Value', date_text: '21 Dec 2023',
    author: 'Gracia', image: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800',
    body: 'Solar panels, energy-efficient appliances, and good insulation cut bills and raise resale value. Buyers pay a premium for green-certified homes.',
  },
];

const DEMO_FAQS = [
  ['What are the benefits of using this app to find properties?', 'ما فوائد استخدام هذا التطبيق للبحث عن العقارات?', 'Our app provides easy access to thousands of properties with advanced search features.', 'يوفر تطبيقنا وصولاً سهلاً إلى آلاف العقارات مع مزايا بحث متقدمة.'],
  ['How do I search for properties on this app?', 'كيف أبحث عن العقارات في هذا التطبيق؟', 'Filter by location, price, property type, rooms and more.', 'صفِّ حسب الموقع والسعر ونوع العقار وعدد الغرف وغيرها.'],
  ['How do I save my favorite properties?', 'كيف أحفظ العقارات المفضلة لدي؟', 'Tap the Save button on any property detail page.', 'اضغط زر الحفظ في صفحة تفاصيل أي عقار.'],
  ['How do I contact the agent or property owner?', 'كيف أتواصل مع الوكيل أو مالك العقار؟', 'Tap "Request Info" or the phone icon next to the agent profile.', 'اضغط "طلب معلومات" أو أيقونة الهاتف بجانب حساب الوكيل.'],
  ['What are the steps to rent or buy a property?', 'ما خطوات استئجار أو شراء عقار؟', 'Browse, shortlist, request info, schedule a viewing, complete booking.', 'تصفح واختر واطلب معلومات وحدد موعد معاينة ثم أتمم الحجز.'],
  ['How can I review an agent or property owner?', 'كيف أقيّم الوكيل أو مالك العقار؟', 'Leave a rating and review from the transaction history page.', 'اترك تقييماً ومراجعة من صفحة سجل المعاملات.'],
];

async function seedIfEmpty() {
  const { rows: [p] } = await pool.query('SELECT COUNT(*)::int AS n FROM properties');
  if (p.n === 0) {
    for (const d of DEMO_PROPERTIES) {
      // eslint-disable-next-line no-await-in-loop
      await pool.query(
        `INSERT INTO properties
          (title, title_ar, location, location_ar, description, description_ar,
           price, currency, type, beds, baths, images)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [d.title, d.title_ar, d.location, d.location_ar, d.description, d.description_ar,
          d.price, d.currency, d.type, d.beds, d.baths, JSON.stringify(d.images)]
      );
    }
    console.log('[seed] demo properties inserted');
  }
  const { rows: [n] } = await pool.query('SELECT COUNT(*)::int AS n FROM news');
  if (n.n === 0) {
    for (const a of DEMO_NEWS) {
      // eslint-disable-next-line no-await-in-loop
      await pool.query(
        'INSERT INTO news (title, date_text, author, image, body) VALUES ($1,$2,$3,$4,$5)',
        [a.title, a.date_text, a.author, a.image, a.body]
      );
    }
    console.log('[seed] demo news inserted');
  }
  const { rows: [f] } = await pool.query('SELECT COUNT(*)::int AS n FROM faqs');
  if (f.n === 0) {
    let order = 0;
    for (const [q, qAr, a, aAr] of DEMO_FAQS) {
      order += 1;
      // eslint-disable-next-line no-await-in-loop
      await pool.query('INSERT INTO faqs (q, q_ar, a, a_ar, sort_order) VALUES ($1,$2,$3,$4,$5)', [q, qAr, a, aAr, order]);
    }
    console.log('[seed] demo faqs inserted');
  }
}

module.exports = { seedIfEmpty };
