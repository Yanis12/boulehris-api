import express from "express";
import cors from "cors";
import multer from "multer";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// CORS: erlaube nur deine Netlify-Domain (kannst du gleich eintragen)
const ALLOW_ORIGIN = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: ALLOW_ORIGIN }));

// Datei-Uploads bis 10 MB pro Bild
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

// Healthcheck (damit Render sieht: Dienst läuft)
app.get("/", (req, res) => res.send("Boulehris API läuft ✅"));

// Upload-Endpunkt: nimmt Bilder an, verschickt E-Mail
app.post("/upload", upload.array("files", 20), async (req, res) => {
  try {
    const { name, phone, email, message } = req.body || {};

    const secureFlag = (process.env.SMTP_SECURE === 'true') || String(process.env.SMTP_PORT) === '465';
// ---- NEU: Versand über Brevo HTTP API (kein SMTP) ----
const attachments = (req.files || []).map(f => ({
  content: f.buffer.toString('base64'),
  name: f.originalname
}));

const html = `
  <h3>Neuer Schaden-Upload</h3>
  <p><b>Name:</b> ${name || "-"}<br>
  <b>Telefon:</b> ${phone || "-"}<br>
  <b>E-Mail:</b> ${email || "-"}<br>
  <b>Nachricht:</b> ${message || "-"}</p>
  <p><b>Dateien:</b> ${attachments.length} Anhang/Anhänge</p>
`;

const payload = {
  sender: { email: process.env.FROM_EMAIL, name: "Boulehris Service" },
  to: [{ email: process.env.TO_EMAIL }],
  subject: "Schaden-Upload von der Website",
  htmlContent: html,
  attachment: attachments
};

const brevoResp = await fetch("https://api.brevo.com/v3/smtp/email", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "api-key": process.env.BREVO_API_KEY
  },
  body: JSON.stringify(payload)
});

if (!brevoResp.ok) {
  const t = await brevoResp.text();
  console.error("BREVO_ERROR:", t);
  return res.status(500).json({ ok: false, error: "MAIL_FAILED" });
}
// ---- ENDE neu ----


    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "MAIL_FAILED" });
  }
});

// WICHTIG: Render gibt einen Port vor → den benutzen!
const port = process.env.PORT || 3000;
app.listen(port, () => console.log("API läuft auf Port " + port));
