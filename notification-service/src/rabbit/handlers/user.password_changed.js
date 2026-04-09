import NotificationService from '../../services/notification.service.js';

export default async function handleUserPasswordChanged(payload) {
  const { user_id, email } = payload;

  if (!email) {
    throw new Error('user.password_changed event missing email field');
  }

  await NotificationService.createAndSend({
    userId: user_id,
    email,
    type: 'password_changed',
    channel: 'both',
    template: 'password-changed',
    subject: 'Password changed',
    context: {},
    payload,
  });
}
