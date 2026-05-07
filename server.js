const path = require("path");
const express = require("express");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const port = Number(process.env.PORT || 8080);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

function firstEnv(...keys) {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function getMailConfig() {
  const smtpUser = firstEnv("SMTP_USER", "SMTP_USERNAME");
  const smtpPass = firstEnv("SMTP_PASS", "SMTP_PASSWORD");
  const emailTo = firstEnv("BOOKING_EMAIL_TO", "EMAIL_TO", "CONTACT_EMAIL_TO");
  const fromEmail = firstEnv("SMTP_FROM", "SMTP_USER", "SMTP_USERNAME");
  return { smtpUser, smtpPass, emailTo, fromEmail };
}

function getMissingConfig() {
  const config = getMailConfig();
  return [
    !config.smtpUser ? "SMTP_USER" : "",
    !config.smtpPass ? "SMTP_PASS" : "",
    !config.emailTo ? "BOOKING_EMAIL_TO" : "",
  ].filter(Boolean);
}

function createTransporter() {
  const config = getMailConfig();
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true") === "true",
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
    // Enable verbose logs in dev
    logger: (process.env.MAIL_DEBUG || "false") === "true",
    debug: (process.env.MAIL_DEBUG || "false") === "true",
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toSafeText(value) {
  return String(value || "").trim();
}

function formatHtmlParagraph(value) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

// Simple mail sender helper (to keep ack separate from internal mail)
async function sendMail(to, subject, text, html) {
  const transporter = createTransporter();
  const config = getMailConfig();
  await transporter.sendMail({
    from: `"Prime Advertere" <${config.fromEmail}>`,
    to,
    subject,
    text,
    html,
  });
}

async function sendWebsiteEmail({ replyTo, subject, textLines, htmlLines }) {
  const transporter = createTransporter();
  const config = getMailConfig();
  console.log("[SMTP] Sending internal booking email to", config.emailTo);
  await transporter.sendMail({
    from: `"Prime Advertere Website" <${config.fromEmail}>`,
    to: config.emailTo,
    replyTo,
    subject,
    text: textLines.join("\n"),
    html: htmlLines.join(""),
  });
}

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Lightweight diagnostic endpoint to test Gmail SMTP locally
app.post("/api/mail-test", async (req, res) => {
  const config = getMailConfig();
  const to = toSafeText(req.body?.to || config.emailTo || req.body?.email);
  if (!to) {
    return res.status(400).json({ ok: false, message: "Recipient email is required for test" });
  }
  const subject = req.body?.subject || "Prime Advertere SMTP test";
  const text = req.body?.text || "This is a test email from Prime Advertere";
  const html = req.body?.html || `<p>${text}</p>`;
  try {
    await sendMail(to, subject, text, html);
    res.json({ ok: true, message: "Test email sent" });
  } catch (err) {
    console.error("Test email failed:", err);
    res.status(500).json({ ok: false, message: "Test email failed" });
  }
});

app.post("/api/book-demo", async (req, res) => {
  console.log('[BOOK-DEMO] request received', { fullName: req.body?.fullName, email: req.body?.email, hasMessage: !!req.body?.message });
  console.log('[BOOK-DEMO] payload:', req.body);
  const missingConfig = getMissingConfig();
  if (missingConfig.length) {
    return res.status(500).json({
      ok: false,
      message: `Missing email configuration: ${missingConfig.join(", ")}`,
    });
  }

  let fullName = toSafeText(req.body.fullName);
  if (!fullName) {
    const f = toSafeText(req.body.firstName);
    const l = toSafeText(req.body.lastName);
    fullName = [f, l].filter(Boolean).join(" ");
  }
  const email = toSafeText(req.body.email);
  const phone = toSafeText(req.body.phone);
  const message = toSafeText(req.body.message);
  console.log("booking-demo payload:", { fullName, email, phone, messagePreview: (message || '').slice(0, 60) });

  if (!fullName || !email || !phone || !message) {
    return res.status(400).json({
      ok: false,
      message: "Please fill out all required fields.",
    });
  }

  try {
    await sendWebsiteEmail({
      replyTo: `"${fullName}" <${email}>`,
      subject: `New Book Free Demo request from ${fullName}`,
      textLines: [
        "New booking form submission",
        "",
        `Name: ${fullName}`,
        `Email: ${email}`,
        `Phone: ${phone}`,
        "",
        "Message:",
        message,
      ],
      htmlLines: [
        "<h2>New booking form submission</h2>",
        `<p><strong>Name:</strong> ${escapeHtml(fullName)}</p>`,
        `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
        `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>`,
        "<p><strong>Message:</strong></p>",
        `<p>${formatHtmlParagraph(message)}</p>`,
      ],
    });

    // Send acknowledgement to the user
    try {
      console.log("Sending acknowledgement to:", email);
      const ackSubject = `We’ve received your message, ${fullName}`;
      const ackText = `Hi ${fullName},\n\nThank you for reaching out to Prime Advertere. We’ve received your message and will get back to you shortly.\n\nMessage:\n${message}\n\nBest regards,\nPrime Advertere`;
      const ackHtml = `<p>Hi ${escapeHtml(fullName)},</p><p>Thank you for reaching out to Prime Advertere. We’ve received your message and will get back to you shortly.</p><p><strong>Your message:</strong><br/>${formatHtmlParagraph(message)}</p><p>Best regards,<br/>Prime Advertere</p>`;
      await sendMail(email, ackSubject, ackText, ackHtml);
    } catch (err) {
      console.error("Acknowledgement email failed:", err);
    }

    return res.json({
      ok: true,
      message: "Thanks. Your message was sent successfully.",
    });
  } catch (error) {
    console.error("Email send failed:", error);
    return res.status(500).json({
      ok: false,
      message: "Sorry, we could not send your message right now.",
    });
  }
});

app.post("/api/blog-subscribe", async (req, res) => {
  const missingConfig = getMissingConfig();
  if (missingConfig.length) {
    return res.status(500).json({
      ok: false,
      message: `Missing email configuration: ${missingConfig.join(", ")}`,
    });
  }

  const email = toSafeText(req.body.email);

  if (!email) {
    return res.status(400).json({
      ok: false,
      message: "Please enter your email address.",
    });
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return res.status(400).json({
      ok: false,
      message: "Please enter a valid email address.",
    });
  }

  try {
    await sendWebsiteEmail({
      replyTo: email,
      subject: `New blog subscribe request from ${email}`,
      textLines: [
        "New blog subscribe request",
        "",
        `Email: ${email}`,
        "Source: blog-details.html",
      ],
      htmlLines: [
        "<h2>New blog subscribe request</h2>",
        `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
        "<p><strong>Source:</strong> blog-details.html</p>",
      ],
    });

    return res.json({
      ok: true,
      message: "Thanks. You are subscribed successfully.",
    });
  } catch (error) {
    console.error("Subscribe email send failed:", error);
    return res.status(500).json({
      ok: false,
      message: "Sorry, we could not process your subscription right now.",
    });
  }
});

app.post("/api/order-intake", async (req, res) => {
  const missingConfig = getMissingConfig();
  if (missingConfig.length) {
    return res.status(500).json({
      ok: false,
      message: `Missing email configuration: ${missingConfig.join(", ")}`,
    });
  }

  const plan = toSafeText(req.body.plan).toLowerCase();
  const firstName = toSafeText(req.body.firstName);
  const lastName = toSafeText(req.body.lastName);
  const businessName = toSafeText(req.body.businessName);
  const email = toSafeText(req.body.email);
  const phone = toSafeText(req.body.phone);
  const website = toSafeText(req.body.website);
  const businessType = toSafeText(req.body.businessType);
  const goals = toSafeText(req.body.goals);
  const notes = toSafeText(req.body.notes);

  if (!["starter", "basic"].includes(plan)) {
    return res.status(400).json({
      ok: false,
      message: "Please select a valid plan before submitting.",
    });
  }

  if (!firstName || !lastName || !businessName || !email || !phone) {
    return res.status(400).json({
      ok: false,
      message: "Please complete all required fields before submitting.",
    });
  }

  const fullName = `${firstName} ${lastName}`.trim();
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);

  try {
    await sendWebsiteEmail({
      replyTo: `"${fullName}" <${email}>`,
      subject: `New ${planLabel} plan request from ${businessName}`,
      textLines: [
        `New ${planLabel} plan request`,
        "",
        `Plan: ${planLabel}`,
        `Name: ${fullName}`,
        `Business: ${businessName}`,
        `Email: ${email}`,
        `Phone: ${phone}`,
        `Website: ${website || "Not provided"}`,
        `Business type: ${businessType || "Not provided"}`,
        "",
        "Goals:",
        goals || "Not provided",
        "",
        "Notes:",
        notes || "Not provided",
      ],
      htmlLines: [
        `<h2>New ${escapeHtml(planLabel)} plan request</h2>`,
        `<p><strong>Plan:</strong> ${escapeHtml(planLabel)}</p>`,
        `<p><strong>Name:</strong> ${escapeHtml(fullName)}</p>`,
        `<p><strong>Business:</strong> ${escapeHtml(businessName)}</p>`,
        `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
        `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>`,
        `<p><strong>Website:</strong> ${escapeHtml(website || "Not provided")}</p>`,
        `<p><strong>Business type:</strong> ${escapeHtml(businessType || "Not provided")}</p>`,
        "<p><strong>Goals:</strong></p>",
        `<p>${formatHtmlParagraph(goals || "Not provided")}</p>`,
        "<p><strong>Notes:</strong></p>",
        `<p>${formatHtmlParagraph(notes || "Not provided")}</p>`,
      ],
    });

    return res.json({
      ok: true,
      message: "Thanks. Your plan request was submitted successfully.",
    });
  } catch (error) {
    console.error("Order intake send failed:", error);
    return res.status(500).json({
      ok: false,
      message: "Sorry, we could not submit your request right now.",
    });
  }
});

app.post("/api/premium-application", async (req, res) => {
  const missingConfig = getMissingConfig();
  if (missingConfig.length) {
    return res.status(500).json({
      ok: false,
      message: `Missing email configuration: ${missingConfig.join(", ")}`,
    });
  }

  const firstName = toSafeText(req.body.firstName);
  const lastName = toSafeText(req.body.lastName);
  const company = toSafeText(req.body.company);
  const email = toSafeText(req.body.email);
  const phone = toSafeText(req.body.phone);
  const website = toSafeText(req.body.website);
  const serviceArea = toSafeText(req.body.serviceArea);
  const goals = toSafeText(req.body.goals);
  const currentStrategy = toSafeText(req.body.currentStrategy);
  const notes = toSafeText(req.body.notes);

  if (!firstName || !lastName || !company || !email || !phone || !goals) {
    return res.status(400).json({
      ok: false,
      message: "Please complete all required fields before submitting.",
    });
  }

  const fullName = `${firstName} ${lastName}`.trim();

  try {
    await sendWebsiteEmail({
      replyTo: `"${fullName}" <${email}>`,
      subject: `New Premium application from ${company}`,
      textLines: [
        "New Premium application",
        "",
        `Name: ${fullName}`,
        `Business: ${company}`,
        `Email: ${email}`,
        `Phone: ${phone}`,
        `Website: ${website || "Not provided"}`,
        `Service area: ${serviceArea || "Not provided"}`,
        "",
        "Goals:",
        goals,
        "",
        "Current strategy:",
        currentStrategy || "Not provided",
        "",
        "Notes:",
        notes || "Not provided",
      ],
      htmlLines: [
        "<h2>New Premium application</h2>",
        `<p><strong>Name:</strong> ${escapeHtml(fullName)}</p>`,
        `<p><strong>Business:</strong> ${escapeHtml(company)}</p>`,
        `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
        `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>`,
        `<p><strong>Website:</strong> ${escapeHtml(website || "Not provided")}</p>`,
        `<p><strong>Service area:</strong> ${escapeHtml(serviceArea || "Not provided")}</p>`,
        "<p><strong>Goals:</strong></p>",
        `<p>${formatHtmlParagraph(goals)}</p>`,
        "<p><strong>Current strategy:</strong></p>",
        `<p>${formatHtmlParagraph(currentStrategy || "Not provided")}</p>`,
        "<p><strong>Notes:</strong></p>",
        `<p>${formatHtmlParagraph(notes || "Not provided")}</p>`,
      ],
    });

    return res.json({
      ok: true,
      message: "Thanks. Your Premium application was submitted successfully.",
    });
  } catch (error) {
    console.error("Premium application send failed:", error);
    return res.status(500).json({
      ok: false,
      message: "Sorry, we could not submit your application right now.",
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Keep 404 handling after all routes so valid API endpoints can execute.
app.use((req, res, next) => {
  console.log("[warn] 404 for", req.method, req.originalUrl);
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(404).json({ ok: false, message: "Not Found" });
  }
  next();
});

app.use((req, res) => {
  res.status(404).json({ ok: false, message: "Not Found" });
});

app.use((err, req, res, _next) => {
  console.error("Unhandled error in request:", err);
  if (!res.headersSent) {
    res.status(500).json({ ok: false, message: "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`Prime Advertere server running at http://127.0.0.1:${port}`);
});
