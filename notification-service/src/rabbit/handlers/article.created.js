import NotificationService from '../../services/notification.service.js';

export default async function handleArticleCreated(payload) {
  const { article_id, title, type } = payload;

  if (!article_id || !title) {
    throw new Error('article.created event missing required fields');
  }

  const contentType = type === 'blog' ? 'Blog post' : 'News article';

  await NotificationService.createBroadcast({
    type: 'article_created',
    title: `New ${contentType}: ${title}`,
    payload,
  });
}
