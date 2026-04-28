const nodemailer = require('nodemailer');

async function sendMail(to, subject, text, html) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: (process.env.SMTP_SECURE || 'true') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  await transporter.sendMail({ from: `"Prime Advertere Website" <${process.env.SMTP_USER}>`, to, subject, text, html });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, message: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, message: 'Invalid JSON' }) };
  }

  // Basic validation
  const firstName = (body.firstName || '').trim();
  const lastName = (body.lastName || '').trim();
  const fullName = ((body.fullName || (firstName && lastName ? `${firstName} ${lastName}` : '')) || '').trim();
  const email = (body.email || '').trim();
  const phone = (body.phone || '').trim();
  const message = (body.message || '').trim();

  if (!fullName || !email || !phone || !message) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, message: 'Please fill out all required fields.' }) };
  }

  const startTo = process.env.EMAIL_TO;
  const replyTo = email;

  try {
    // Internal notification
    await sendMail(
      startTo,
      `New Booking from ${fullName}`,
      `New booking from ${fullName}\nEmail: ${email}\nPhone: ${phone}\nMessage:\n${message}`,
      `<h2>New Booking</h2><p><strong>Name:</strong> ${fullName}</p><p><strong>Email:</strong> ${email}</p><p><strong>Phone:</strong> ${phone}</p><p><strong>Message:</strong><br/>${message}</p>`
    );

    // Acknowledgement to user
    const ackSubject = `We’ve received your message, ${fullName}`;
    const ackText = `Hi ${fullName},\n\nThank you for reaching out to Prime Advertere. We’ve received your message and will get back to you shortly.\n\nMessage:\n${message}\n\nBest regards,\nPrime Advertere`;
    const ackHtml = `<p>Hi ${fullName},</p><p>Thank you for reaching out to Prime Advertere. We’ve received your message and will get back to you shortly.</p><p><strong>Your message:</strong><br/>${message}</p><p>Best regards,<br/>Prime Advertere</p>`;
    await sendMail(email, ackSubject, ackText, ackHtml);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, message: 'Thanks. Your message was sent successfully.' }),
    };
  } catch (err) {
    console.error('Booking book-demo failed:', err);
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: 'Email send failed.' }) };
  }
};
