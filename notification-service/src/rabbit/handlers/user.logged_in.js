import NotificationService from '../../services/notification.service.js';

export default async function handleUserLoggedIn(payload) {
  const { user_id, email, device, ts } = payload;

  if (!email) {
    throw new Error('user.logged_in event missing email field');
  }

  const loginTime = ts ? new Date(ts * 1000).toLocaleString('en-US', { timeZone: 'UTC' }) : new Date().toLocaleString();

  await NotificationService.createAndSend({
    userId: user_id,
    email,
    type: 'new_login',
    channel: 'both',
    template: 'new-login',
    subject: 'New login detected',
    context: { device: device || 'Unknown device', loginTime },
    payload,
  });
}
