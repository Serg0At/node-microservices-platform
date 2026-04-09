import { UserSchemas } from './schemas/index.js';

const user = new UserSchemas();

export default class Validation {
  static validateGetProfile(data) {
    return user.GetProfileScheme.validate(data, { abortEarly: false });
  }

  static validateUpdateProfile(data) {
    return user.UpdateProfileScheme.validate(data, { abortEarly: false });
  }

  static validateUploadAvatar(data) {
    return user.UploadAvatarScheme.validate(data, { abortEarly: false });
  }
}
