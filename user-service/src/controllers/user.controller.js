import UserService from '../services/user.service.js';
import { SuccessHandler, ErrorHandler } from '../utils/index.js';
import { Validation } from '../middlewares/validations/index.js';

export default class UserController {
  static async getProfile(call, callback) {
    const meta = { method: 'GetProfile' };
    try {
      const { user_id } = call.request;

      const { error: validationError } = Validation.validateGetProfile({ user_id });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map((d) => d.message).join('; '), meta);
      }

      const result = await UserService.getProfile({ userId: user_id });

      SuccessHandler.profileFetched(callback, result, { ...meta, userId: user_id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async updateProfile(call, callback) {
    const meta = { method: 'UpdateProfile' };
    try {
      const { access_token, username, display_name } = call.request;

      const { error: validationError } = Validation.validateUpdateProfile({
        access_token,
        username,
        display_name,
      });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map((d) => d.message).join('; '), meta);
      }

      const result = await UserService.updateProfile({
        accessToken: access_token,
        username,
        displayName: display_name,
      });

      SuccessHandler.profileUpdated(callback, result, { ...meta, userId: result.profile.user_id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }

  static async uploadAvatar(call, callback) {
    const meta = { method: 'UploadAvatar' };
    try {
      const { access_token, image_data, content_type, file_name } = call.request;

      const { error: validationError } = Validation.validateUploadAvatar({
        access_token,
        image_data,
        content_type,
        file_name,
      });
      if (validationError) {
        return ErrorHandler.invalidArgument(callback, validationError.details.map((d) => d.message).join('; '), meta);
      }

      const result = await UserService.uploadAvatar({
        accessToken: access_token,
        imageData: image_data,
        contentType: content_type,
        fileName: file_name,
      });

      SuccessHandler.profileUpdated(callback, result, { ...meta, userId: result.profile.user_id });
    } catch (error) {
      ErrorHandler.handle(callback, error, meta);
    }
  }
}
