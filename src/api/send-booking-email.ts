import express from 'express';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

router.post('/send-booking-email', async (req, res) => {
  const { to, name, facility, date, time } = req.body;

  if (!to || !name || !facility || !date || !time) {
    return res.status(400).json({ error: 'Missing booking data' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const html = `
    <div style="font-family: sans-serif;">
      <h2>Halo ${name} 👋</h2>
      <p>Booking kamu untuk fasilitas <strong>${facility}</strong> sudah dikonfirmasi.</p>
      <p><strong>Tanggal:</strong> ${date}<br/><strong>Waktu:</strong> ${time}</p>
      <p>Terima kasih!</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Sport Center Booking" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Konfirmasi Booking Anda',
      html,
    });

    res.status(200).json({ message: 'Email sent' });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

export default router;
