import NotificationService from '../../services/notification.service.js';

export default async function handleUserVerifyEmail(payload) {
  const { user_id, email, verification_token } = payload;

  const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verification_token}`;

  await NotificationService.createAndSend({
    userId: user_id,
    email,
    type: 'verify_email',
    template: 'verify-email',
    subject: 'Verify your email',
    context: { verificationLink },
    payload,
  });
}
