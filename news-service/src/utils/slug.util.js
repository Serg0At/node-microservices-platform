import slugify from 'slugify';
import ArticleModel from '../models/Article.js';

export async function generateUniqueSlug(title) {
  let base = slugify(title, { lower: true, strict: true });
  let slug = base;
  let existing = await ArticleModel.findBySlug(slug);
  let counter = 1;

  while (existing) {
    slug = `${base}-${counter}`;
    existing = await ArticleModel.findBySlug(slug);
    counter++;
  }

  return slug;
}
