import Joi from 'joi';

export default class UserSchemas {
  GetProfileScheme = Joi.object({
    user_id: Joi.string().pattern(/^\d+$/).required()
      .messages({ 'string.pattern.base': 'user_id must be a numeric string' }),
  });

  UpdateProfileScheme = Joi.object({
    access_token: Joi.string().min(1).required(),
    username: Joi.string()
      .pattern(/^[^@]+$/, { name: 'no-at-sign' })
      .min(3)
      .max(30)
      .optional()
      .allow('')
      .messages({ 'string.pattern.name': 'Username must not contain "@"' }),
    display_name: Joi.string().max(100).optional().allow(''),
  });

  UploadAvatarScheme = Joi.object({
    access_token: Joi.string().min(1).required(),
    image_data: Joi.binary().required(),
    content_type: Joi.string()
      .valid('image/png', 'image/jpeg', 'image/webp', 'image/gif')
      .required()
      .messages({ 'any.only': 'Allowed types: png, jpeg, webp, gif' }),
    file_name: Joi.string().max(255).required(),
  });
}
