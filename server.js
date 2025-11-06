import express from "express";
import cors from "cors";
import multer from "multer";
import nodemailer from "nodemailer"; // (nicht genutzt, aber lassen wir wie gehabt)
import dotenv from "dotenv";

dotenv.config();
const app = express();

// CORS: erlaube deine Netlify-Domain (oder * wenn du nichts ändern willst)
const ALLOW_ORIGIN = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: ALLOW_ORIGIN }));

// Upload-Limits: 10 MB je Datei, max. 60 Dateien (wie bei dir)
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 60
  }
});

// Healthcheck (Frontend ist auf Netlify – hier nur "läuft"-Seite)
app.get("/", (req, res) => res.send("Boulehris API läuft ✅"));

// Upload-Endpunkt: nimmt Bilder + Text an und verschickt via Brevo
app.post("/upload", upload.array("files", 60), async (req, res) => {
  try {
    // NEU: alle Felder, die dein Frontend jetzt mitsendet
    const {
      name,
      phone,
      email,
      message,
      accident_date,
      accident_place,
      license_plate
    } = req.body || {};

    // Anhänge (wie bisher)
    const attachments = (req.files || []).map(f => ({
      content: f.buffer.toString("base64"),
      name: f.originalname
    }));

    // E-Mail-Inhalt (HTML)
    const html = `
      <h3>Neuer Schaden-Upload</h3>
      <p>
        <b>Name:</b> ${name || "-"}<br>
        <b>Telefon:</b> ${phone || "-"}<br>
        <b>E-Mail:</b> ${email || "-"}<br>
        <b>Kennzeichen:</b> ${license_plate || "-"}<br>
        <b>Unfall-Datum:</b> ${accident_date || "-"}<br>
        <b>Unfall-Ort:</b> ${accident_place || "-"}<br>
        <b>Nachricht:</b> ${message || "-"}
      </p>
      <p><b>Dateien:</b> ${attachments.length} Anhang/Anhänge</p>
    `;

    // Versand über Brevo HTTP API (wie bei dir)
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
      const t = await brevoResp.text().catch(() => "");
      console.error("BREVO_ERROR:", t);
      return res.status(500).json({ ok: false, error: "MAIL_FAILED" });
    }

    const okBody = await brevoResp.json().catch(() => ({}));
    console.log("BREVO_OK:", okBody);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "MAIL_FAILED" });
  }
});

// Fehler bei Multer schön zurückgeben
app.use((err, _req, res, next) => {
  if (err && err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({ ok: false, error: "TOO_MANY_FILES", max: 60 });
  }
  if (err && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ ok: false, error: "FILE_TOO_BIG", maxBytes: 10 * 1024 * 1024 });
  }
  next(err);
});

// Render-Start
const port = process.env.PORT || 3000;
app.listen(port, () => console.log("API läuft auf Port " + port));
