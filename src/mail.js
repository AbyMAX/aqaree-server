// OTP delivery via Brevo HTTP API (no extra dependency, uses global fetch).
// Without a key (local dev) the code is logged so flows can still be tested.
async function sendOtpEmail(to, code) {
  const key = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SENDER_EMAIL;
  if (!key || !sender) {
    console.log(`[dev] OTP for ${to}: ${code}`);
    return { dev: true };
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: sender, name: 'Aqaree' },
      to: [{ email: to }],
      subject: 'Your Aqaree verification code',
      textContent: `Your Aqaree verification code is: ${code}\nIt expires in 10 minutes.`,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo rejected the email (${res.status}): ${body.slice(0, 200)}`);
  }
  return { sent: true };
}

module.exports = { sendOtpEmail };
