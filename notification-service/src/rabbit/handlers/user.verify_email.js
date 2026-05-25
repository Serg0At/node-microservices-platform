import NotificationService from '../../services/notification.service.js';
import config from '../../config/variables.config.js';
import logger from '../../utils/logger.util.js';

export default async function handleUserVerifyEmail(payload) {
  const { user_id, email, username, verification_token } = payload;

  logger.info('user.verify_email received', {
    user_id,
    email,
    has_token: !!verification_token,
    token_preview: verification_token
      ? `${verification_token.slice(0, 6)}…${verification_token.slice(-4)}`
      : null,
    frontend_url: config.FRONTEND.URL,
  });

  if (!user_id || !email || !verification_token) {
    // Throw, do NOT silently ack — this is a malformed event and we want it
    // visible in dead-letter / retry metrics instead of disappearing into a
    // single log line.
    throw new Error(
      `user.verify_email: missing required fields (user_id=${!!user_id}, email=${!!email}, token=${!!verification_token})`
    );
  }

  const verificationLink = `${config.FRONTEND.URL}/verify-email?token=${verification_token}`;

  logger.info('Built verification link, dispatching email', {
    user_id,
    email,
    template: 'verify-email',
    subject: 'Verify your email',
    link_host: new URL(verificationLink).host,
  });

  const result = await NotificationService.createAndSend({
    userId: user_id,
    email,
    type: 'verify_email',
    template: 'verify-email',
    subject: 'Verify your email',
    context: {
      username: username || 'there',
      verificationLink,
    },
    payload,
  });

  logger.info('Verification email dispatched', {
    user_id,
    notification_id: result?.notificationId,
  });
}
