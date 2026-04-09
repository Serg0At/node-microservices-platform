import Joi from 'joi';

export default class UserSchemas {
  UpdateProfileScheme = Joi.object({
    username: Joi.string()
      .pattern(/^[^@]+$/, { name: 'no-at-sign' })
      .min(3)
      .max(30)
      .optional()
      .messages({ 'string.pattern.name': 'Username must not contain "@"' }),
    displayName: Joi.string().max(50).allow('').optional(),
  }).min(1);

  UploadAvatarScheme = Joi.object({
    contentType: Joi.string()
      .valid('image/png', 'image/jpeg', 'image/webp', 'image/gif')
      .required()
      .messages({ 'any.only': 'Allowed types: png, jpeg, webp, gif' }),
    fileName: Joi.string().max(255).required(),
  });
}
