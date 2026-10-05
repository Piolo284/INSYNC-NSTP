const nodemailer = require('nodemailer');

let transporter = null;
let warned = false;

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_HOST.trim());
}

function getTransporter() {
  if (!isConfigured()) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE) === 'true',
    auth:
      process.env.SMTP_USER || process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });

  return transporter;
}

/**
 * Sends mail when SMTP is configured. In development (no SMTP_HOST) it logs the
 * message instead and reports delivered:false so callers can surface the code
 * to the tester rather than silently failing.
 */
async function sendMail({ to, subject, text, html }) {
  const tx = getTransporter();

  if (!tx) {
    if (!warned) {
      console.warn(
        '[mail] SMTP_HOST is empty — running in DEV mode, emails are logged only.'
      );
      warned = true;
    }
    console.log(`[mail:dev] to=${to} subject="${subject}"\n${text || html}`);
    return { delivered: false, devMode: true };
  }

  await tx.sendMail({
    from: process.env.MAIL_FROM || 'MARSU NSTP Portal <no-reply@marsu.edu.ph>',
    to,
    subject,
    text,
    html,
  });

  return { delivered: true, devMode: false };
}

async function sendAttendanceCode({ to, name, code, sessionTitle, minutes }) {
  const subject = 'Your NSTP attendance verification code';
  const text =
    `Hi ${name},\n\n` +
    `Your attendance verification code is: ${code}\n\n` +
    `Session: ${sessionTitle}\n` +
    `This code expires in ${minutes} minutes.\n\n` +
    `If you did not scan an attendance QR code, you can ignore this email.`;

  return sendMail({ to, subject, text });
}

async function sendPasswordResetCode({ to, name, code, minutes }) {
  const subject = 'Your NSTP Portal password reset code';
  const text =
    `Hi ${name},\n\n` +
    `Your password reset request has been approved. Your reset code is: ${code}\n\n` +
    `This code expires in ${minutes} minutes.\n\n` +
    `If you did not request a password reset, please contact your NSTP administrator.`;

  return sendMail({ to, subject, text });
}

/** Shared by the email-change, contact-number-change, and two-factor-login
 * flows — same "here's your 6-digit code" shape, different purpose line. */
async function sendVerificationCode({ to, name, code, purpose, minutes }) {
  const subject = 'Your NSTP Portal verification code';
  const text =
    `Hi ${name},\n\n` +
    `Your verification code to ${purpose} is: ${code}\n\n` +
    `This code expires in ${minutes} minutes.\n\n` +
    `If you did not request this, please contact your NSTP administrator.`;

  return sendMail({ to, subject, text });
}

module.exports = { sendMail, sendAttendanceCode, sendPasswordResetCode, sendVerificationCode, isConfigured };
