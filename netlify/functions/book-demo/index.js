const nodemailer = require('nodemailer');

function firstEnv(...keys) {
  for (const key of keys) {
    const value = String(process.env[key] || '').trim();
    if (value) {
      return value;
    }
  }
  return '';
}

function getMailConfig() {
  const smtpUser = firstEnv('SMTP_USER', 'SMTP_USERNAME');
  const smtpPass = firstEnv('SMTP_PASS', 'SMTP_PASSWORD');
  const emailTo = firstEnv('BOOKING_EMAIL_TO', 'EMAIL_TO', 'CONTACT_EMAIL_TO');
  const fromEmail = firstEnv('SMTP_FROM', 'SMTP_USER', 'SMTP_USERNAME');
  return { smtpUser, smtpPass, emailTo, fromEmail };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatHtmlParagraph(value) {
  return escapeHtml(value).replace(/\n/g, '<br />');
}

async function sendMail(to, subject, text, html) {
  const config = getMailConfig();
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: (process.env.SMTP_SECURE || 'true') === 'true',
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });

  await transporter.sendMail({
    from: `"Prime Advertere Website" <${config.fromEmail}>`,
    to,
    subject,
    text,
    html,
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ ok: false, message: 'Method not allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ ok: false, message: 'Invalid JSON' }),
    };
  }

  const firstName = (body.firstName || '').trim();
  const lastName = (body.lastName || '').trim();
  const fullName = (
    body.fullName || (firstName && lastName ? `${firstName} ${lastName}` : '')
  ).trim();
  const email = (body.email || '').trim();
  const phone = (body.phone || '').trim();
  const message = (body.message || '').trim();
  const config = getMailConfig();
  const missingConfig = [
    !config.smtpUser ? 'SMTP_USER' : '',
    !config.smtpPass ? 'SMTP_PASS' : '',
    !config.emailTo ? 'BOOKING_EMAIL_TO' : '',
  ].filter(Boolean);

  if (missingConfig.length) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        message: `Missing email configuration: ${missingConfig.join(', ')}`,
      }),
    };
  }

  if (!fullName || !email || !phone || !message) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        ok: false,
        message: 'Please fill out all required fields.',
      }),
    };
  }

  try {
    await sendMail(
      config.emailTo,
      `New Booking from ${fullName}`,
      `New booking from ${fullName}\nEmail: ${email}\nPhone: ${phone}\nMessage:\n${message}`,
      `<h2>New Booking</h2><p><strong>Name:</strong> ${escapeHtml(fullName)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Phone:</strong> ${escapeHtml(phone)}</p><p><strong>Message:</strong><br/>${formatHtmlParagraph(message)}</p>`
    );

    const ackSubject = `We've received your message, ${fullName}`;
    const ackText = `Hi ${fullName},\n\nThank you for reaching out to Prime Advertere. We've received your message and will get back to you shortly.\n\nMessage:\n${message}\n\nBest regards,\nPrime Advertere`;
    const ackHtml = `<p>Hi ${escapeHtml(fullName)},</p><p>Thank you for reaching out to Prime Advertere. We've received your message and will get back to you shortly.</p><p><strong>Your message:</strong><br/>${formatHtmlParagraph(message)}</p><p>Best regards,<br/>Prime Advertere</p>`;

    await sendMail(email, ackSubject, ackText, ackHtml);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        message: 'Thanks. Your message was sent successfully.',
      }),
    };
  } catch (error) {
    console.error('Booking book-demo failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, message: 'Email send failed.' }),
    };
  }
};
