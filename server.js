try {
  require('dotenv').config();
} catch {
  // dotenv not installed yet; environment variables can still be set directly
}

const express = require('express');
const path = require('path');
const fs = require('fs');

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch {
  console.warn('nodemailer is not installed yet — run "npm install" to enable email sending.');
}

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || GMAIL_USER;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(SUBMISSIONS_FILE)) fs.writeFileSync(SUBMISSIONS_FILE, '[]');

let transporter = null;
if (nodemailer && GMAIL_USER && GMAIL_APP_PASSWORD) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
  });
} else {
  console.warn(
    'Email sending is disabled: set GMAIL_USER and GMAIL_APP_PASSWORD in .env to enable it. ' +
    'Submissions will still be saved to data/submissions.json.'
  );
}

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

app.post('/api/contact', async (req, res) => {
  const { name, email, phone, service, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: 'Name, email, and message are required.' });
  }

  const submission = {
    name: String(name).slice(0, 200),
    email: String(email).slice(0, 200),
    phone: phone ? String(phone).slice(0, 50) : '',
    service: service ? String(service).slice(0, 100) : '',
    message: String(message).slice(0, 2000),
    receivedAt: new Date().toISOString()
  };

  try {
    const data = await fs.promises.readFile(SUBMISSIONS_FILE, 'utf8');
    let submissions = [];
    try {
      submissions = JSON.parse(data);
    } catch {
      submissions = [];
    }
    submissions.push(submission);
    await fs.promises.writeFile(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2));
  } catch (err) {
    console.error('Failed to save submission:', err);
    return res.status(500).json({ ok: false, error: 'Server error, please try again later.' });
  }

  console.log(`New contact form submission from ${submission.name} <${submission.email}>`);

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"Greg Life Stylz Website" <${GMAIL_USER}>`,
        to: CONTACT_TO_EMAIL,
        replyTo: submission.email,
        subject: `Website Inquiry: ${submission.service || 'General'}`,
        text:
          `Name: ${submission.name}\n` +
          `Phone: ${submission.phone}\n` +
          `Email: ${submission.email}\n` +
          `Service: ${submission.service}\n\n` +
          `Message:\n${submission.message}`
      });
    } catch (err) {
      console.error('Failed to send notification email (submission was still saved):', err.message);
    }
  }

  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Greg Life Stylz website running at http://localhost:${PORT}`);
});
