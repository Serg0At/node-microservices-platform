import nodemailer from 'nodemailer';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/variables.config.js';
import logger from '../utils/logger.util.js';
import { smtpBreaker } from '../utils/circuit-breaker.util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, '../templates');

let transporter = null;
const compiledTemplates = new Map();

/**
 * Initialize Nodemailer transporter and compile all Handlebars templates.
 */
export const initEmailService = async () => {
  transporter = nodemailer.createTransport({
    host: config.SMTP.HOST,
    port: config.SMTP.PORT,
    secure: config.SMTP.SECURE,
    auth: {
      user: config.SMTP.USER,
      pass: config.SMTP.PASSWORD,
    },
  });

  try {
    await transporter.verify();
    logger.info('SMTP transporter verified');
  } catch (err) {
    logger.warn('SMTP transporter verification failed (emails may fail)', { error: err.message });
  }

  compileTemplates();
};

/**
 * Read and compile all .hbs templates at startup.
 */
function compileTemplates() {
  // Register base layout as a partial
  const layoutPath = path.join(TEMPLATES_DIR, 'layouts', 'base.hbs');
  if (fs.existsSync(layoutPath)) {
    const layoutSource = fs.readFileSync(layoutPath, 'utf-8');
    Handlebars.registerPartial('base', layoutSource);
  }

  // Compile all top-level .hbs files
  const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.hbs'));
  for (const file of files) {
    const name = file.replace('.hbs', '');
    const source = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf-8');
    compiledTemplates.set(name, Handlebars.compile(source));
  }

  logger.info(`Compiled ${compiledTemplates.size} email templates`, {
    templates: Array.from(compiledTemplates.keys()),
  });
}

/**
 * Send an email using a compiled Handlebars template.
 *
 * @param {object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.subject - Email subject
 * @param {string} params.template - Template name (without .hbs)
 * @param {object} params.context - Template variables
 * @returns {{ messageId, accepted, rejected }}
 */
export const sendEmail = async ({ to, subject, template, context }) => {
  if (!transporter) throw new Error('Email transporter not initialized');

  const compiledTemplate = compiledTemplates.get(template);
  if (!compiledTemplate) throw new Error(`Email template "${template}" not found`);

  const html = compiledTemplate({
    ...context,
    serviceName: config.SMTP.FROM_NAME,
    year: new Date().getFullYear(),
  });

  const mailOptions = {
    from: `"${config.SMTP.FROM_NAME}" <${config.SMTP.FROM_EMAIL}>`,
    to,
    subject,
    html,
  };

  const result = await smtpBreaker.fire(async () => {
    return transporter.sendMail(mailOptions);
  });

  logger.debug('Email sent', { to, subject, template, messageId: result.messageId });

  return {
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
  };
};
