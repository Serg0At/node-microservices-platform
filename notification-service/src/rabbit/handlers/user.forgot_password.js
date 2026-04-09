import config from '../../config/variables.config.js';
import NotificationService from '../../services/notification.service.js';

export default async function handleUserForgotPassword(payload) {
  const { user_id, email, code, token } = payload;

  const context = token
    ? { token, resetLink: `${config.FRONTEND.URL}/reset-password?token=${token}` }
    : { resetCode: code };

  await NotificationService.createAndSend({
    userId: user_id,
    email,
    type: 'forgot_password',
    template: 'forgot-password',
    subject: 'Password reset',
    context,
    payload,
  });
}
