const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../auth');

const router = express.Router();

// GET /api/transactions -> grouped like the app renders:
// [{ group, groupAr, items: [{ id, title, titleAr, spec, specAr, price,
//    currency, agent, agentAr, date, dateAr, status }] }]
router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 OR user_id IS NULL ORDER BY id DESC',
      [req.user.id]
    );
    const groups = new Map();
    rows.forEach((r) => {
      const key = r.group_label || 'History';
      if (!groups.has(key)) groups.set(key, { group: key, groupAr: r.group_ar || key, items: [] });
      groups.get(key).items.push({
        id: r.id,
        title: r.title || '',
        titleAr: r.title_ar || '',
        spec: r.spec || '',
        specAr: r.spec_ar || '',
        price: Number(r.price) || 0,
        currency: r.currency || 'SDG',
        agent: r.agent || '',
        agentAr: r.agent_ar || '',
        date: r.date_text || '',
        dateAr: r.date_ar || '',
        status: r.status === 'done' ? 'done' : 'progress',
      });
    });
    return res.json([...groups.values()]);
  } catch (err) {
    console.error('transactions:', err.message);
    return res.status(500).json({ message: 'Could not load transactions' });
  }
});

// GET /api/news + GET /api/news/:id
router.get('/news', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM news ORDER BY id ASC');
    return res.json(
      rows.map((r) => ({
        id: r.id,
        title: r.title || '',
        date: r.date_text || '',
        author: r.author || '',
        image: r.image || '',
        body: r.body || '',
      }))
    );
  } catch (err) {
    console.error('news:', err.message);
    return res.status(500).json({ message: 'Could not load news' });
  }
});

router.get('/news/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM news WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: 'Article not found' });
    const r = rows[0];
    return res.json({
      id: r.id,
      title: r.title || '',
      date: r.date_text || '',
      author: r.author || '',
      image: r.image || '',
      body: r.body || '',
    });
  } catch (err) {
    console.error('news item:', err.message);
    return res.status(500).json({ message: 'Could not load article' });
  }
});

// GET /api/faqs
router.get('/faqs', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT q, q_ar, a, a_ar FROM faqs ORDER BY sort_order ASC, id ASC');
    return res.json(rows.map((r) => ({ q: r.q, qAr: r.q_ar, a: r.a, aAr: r.a_ar })));
  } catch (err) {
    console.error('faqs:', err.message);
    return res.status(500).json({ message: 'Could not load FAQs' });
  }
});

module.exports = router;
