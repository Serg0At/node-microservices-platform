import NotificationService from '../../services/notification.service.js';

export default async function handleUserRegistered(payload) {
  const { user_id, email, username } = payload;

  await NotificationService.createAndSend({
    userId: user_id,
    email,
    type: 'welcome',
    template: 'welcome',
    subject: 'Welcome to Arbex!',
    context: { username: username || 'there' },
    payload,
  });
}
