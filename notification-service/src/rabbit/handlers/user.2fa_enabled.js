import NotificationService from '../../services/notification.service.js';

export default async function handleUser2faEnabled(payload) {
  const { user_id, email } = payload;

  await NotificationService.createAndSend({
    userId: user_id,
    email,
    type: '2fa_enabled',
    channel: 'both',
    template: '2fa-enabled',
    subject: 'Two-Factor Authentication Enabled',
    context: {},
    payload,
  });
}
