const nodemailer = require('nodemailer');

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
};

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
  const emailTo = 'cobybaker16@gmail.com, lead@primeadvertere.com, start@primeadvertere.com';
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

function classifyMailError(error) {
  const code = String(error?.code || '').trim().toUpperCase();
  const responseCode = Number(error?.responseCode || 0);
  const message = String(error?.message || '').toLowerCase();

  if (
    code === 'EAUTH' ||
    responseCode === 535 ||
    message.includes('invalid login') ||
    message.includes('authentication')
  ) {
    return 'SMTP authentication failed. Recheck SMTP_USER and SMTP_PASS.';
  }

  if (
    code === 'ESOCKET' ||
    code === 'ECONNECTION' ||
    code === 'ETIMEDOUT' ||
    message.includes('timeout') ||
    message.includes('connect')
  ) {
    return 'SMTP connection failed. Recheck SMTP_HOST, SMTP_PORT, and SMTP_SECURE.';
  }

  if (responseCode >= 500 && responseCode < 600) {
    return 'The mail server rejected the message. Recheck the sender mailbox and destination address.';
  }

  return 'Email send failed. Check the Netlify function logs for the SMTP error.';
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
      headers: JSON_HEADERS,
      body: JSON.stringify({ ok: false, message: 'Method not allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_error) {
    return {
      statusCode: 400,
      headers: JSON_HEADERS,
      body: JSON.stringify({ ok: false, message: 'Invalid JSON' }),
    };
  }

  const firstName = (body.firstName || '').trim();
  const lastName = (body.lastName || '').trim();
  const fullName = (
    body.fullName || (firstName && lastName ? `${firstName} ${lastName}` : '')
  ).trim();
  const leadType = (body.leadType || 'booking').trim().toLowerCase();
  const businessName = (body.businessName || body.company || '').trim();
  const plan = (body.plan || '').trim();
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
      headers: JSON_HEADERS,
      body: JSON.stringify({
        ok: false,
        message: `Missing email configuration: ${missingConfig.join(', ')}`,
      }),
    };
  }

  if (!fullName || !email || !phone || !message) {
    return {
      statusCode: 400,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        ok: false,
        message: 'Please fill out all required fields.',
      }),
    };
  }

  const subject =
    leadType === 'order-intake'
      ? `New ${plan || 'Plan'} request from ${businessName || fullName}`
      : leadType === 'premium-application'
        ? `New Premium application from ${businessName || fullName}`
        : `New Booking from ${fullName}`;

  const heading =
    leadType === 'order-intake'
      ? 'New plan request'
      : leadType === 'premium-application'
        ? 'New Premium application'
        : 'New Booking';

  const adminText =
    `${heading}\n` +
    `Name: ${fullName}\n` +
    `Email: ${email}\n` +
    `Phone: ${phone}\n` +
    `${businessName ? `Business: ${businessName}\n` : ''}` +
    `${plan ? `Plan: ${plan}\n` : ''}` +
    `Message:\n${message}`;

  const adminHtml =
    `<h2>${escapeHtml(heading)}</h2>` +
    `<p><strong>Name:</strong> ${escapeHtml(fullName)}</p>` +
    `<p><strong>Email:</strong> ${escapeHtml(email)}</p>` +
    `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` +
    (businessName ? `<p><strong>Business:</strong> ${escapeHtml(businessName)}</p>` : '') +
    (plan ? `<p><strong>Plan:</strong> ${escapeHtml(plan)}</p>` : '') +
    `<p><strong>Message:</strong><br/>${formatHtmlParagraph(message)}</p>`;

  const successMessage =
    leadType === 'order-intake'
      ? "Thanks. Your plan request has been received and our team will follow up soon."
      : leadType === 'premium-application'
        ? "Thanks. Your Premium application has been received and our team will follow up soon."
        : "Thanks, your message has been sent. We'll be in touch soon.";

  const ackSubject =
    leadType === 'order-intake'
      ? `We've received your ${plan || 'plan'} request, ${fullName}`
      : leadType === 'premium-application'
        ? `We've received your Premium application, ${fullName}`
        : `We've received your message, ${fullName}`;

  const ackText =
    leadType === 'order-intake'
      ? `Hi ${fullName},\n\nThank you for reaching out to Prime Advertere. We've received your ${plan || 'plan'} request and will follow up shortly.\n\nBest regards,\nPrime Advertere`
      : leadType === 'premium-application'
        ? `Hi ${fullName},\n\nThank you for applying to Prime Advertere Premium. We've received your application and will follow up shortly.\n\nBest regards,\nPrime Advertere`
        : `Hi ${fullName},\n\nThank you for reaching out to Prime Advertere. We've received your message and will get back to you shortly.\n\nMessage:\n${message}\n\nBest regards,\nPrime Advertere`;

  const ackHtml =
    leadType === 'order-intake'
      ? `<p>Hi ${escapeHtml(fullName)},</p><p>Thank you for reaching out to Prime Advertere. We've received your ${escapeHtml(plan || 'plan')} request and will follow up shortly.</p><p>Best regards,<br/>Prime Advertere</p>`
      : leadType === 'premium-application'
        ? `<p>Hi ${escapeHtml(fullName)},</p><p>Thank you for applying to Prime Advertere Premium. We've received your application and will follow up shortly.</p><p>Best regards,<br/>Prime Advertere</p>`
        : `<p>Hi ${escapeHtml(fullName)},</p><p>Thank you for reaching out to Prime Advertere. We've received your message and will get back to you shortly.</p><p><strong>Your message:</strong><br/>${formatHtmlParagraph(message)}</p><p>Best regards,<br/>Prime Advertere</p>`;

  try {
    await sendMail(
      config.emailTo,
      subject,
      adminText,
      adminHtml
    );

    await sendMail(email, ackSubject, ackText, ackHtml);

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        ok: true,
        message: successMessage,
      }),
    };
  } catch (error) {
    console.error('Booking book-demo failed:', {
      code: error?.code || '',
      command: error?.command || '',
      responseCode: error?.responseCode || '',
      response: error?.response || '',
      message: error?.message || '',
    });
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        ok: false,
        message: 'Email send failed.',
        hint: classifyMailError(error),
      }),
    };
  }
};
