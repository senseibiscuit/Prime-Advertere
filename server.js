const path = require("path");
const express = require("express");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const port = Number(process.env.PORT || 8080);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

function getMissingConfig() {
  return ["SMTP_USER", "SMTP_PASS", "EMAIL_TO"].filter(
    (key) => !process.env[key]
  );
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
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

async function sendWebsiteEmail({ replyTo, subject, textLines, htmlLines }) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"Prime Advertere Website" <${process.env.SMTP_USER}>`,
    to: process.env.EMAIL_TO,
    replyTo,
    subject,
    text: textLines.join("\n"),
    html: htmlLines.join(""),
  });
}

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/api/book-demo", async (req, res) => {
  const missingConfig = getMissingConfig();
  if (missingConfig.length) {
    return res.status(500).json({
      ok: false,
      message: `Missing email configuration: ${missingConfig.join(", ")}`,
    });
  }

  const fullName = toSafeText(req.body.fullName);
  const email = toSafeText(req.body.email);
  const phone = toSafeText(req.body.phone);
  const message = toSafeText(req.body.message);

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

app.listen(port, () => {
  console.log(`Prime Advertere server running at http://127.0.0.1:${port}`);
});
