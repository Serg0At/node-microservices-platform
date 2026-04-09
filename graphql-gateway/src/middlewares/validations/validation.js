import { AuthSchemas, UserSchemas, NotificationSchemas, NewsSchemas, AdminSchemas } from './schemas/index.js';

const auth = new AuthSchemas();
const user = new UserSchemas();
const notification = new NotificationSchemas();
const news = new NewsSchemas();
const admin = new AdminSchemas();

export default class Validation {
  static validateRegister(data) {
    return auth.RegisterScheme.validate(data, { abortEarly: false });
  }

  static validateLogin(data) {
    return auth.LoginScheme.validate(data, { abortEarly: false });
  }

  static validateForgotPassword(data) {
    return auth.ForgotPasswordScheme.validate(data, { abortEarly: false });
  }

  static validateVerifyResetCode(data) {
    return auth.VerifyResetCodeScheme.validate(data, { abortEarly: false });
  }

  static validateResetPassword(data) {
    return auth.ResetPasswordScheme.validate(data, { abortEarly: false });
  }

  static validateConfirmPasswordChange(data) {
    return auth.ConfirmPasswordChangeScheme.validate(data, { abortEarly: false });
  }

  static validateRefreshToken(data) {
    return auth.RefreshTokenScheme.validate(data, { abortEarly: false });
  }

  static validateVerifyEmail(data) {
    return auth.VerifyEmailScheme.validate(data, { abortEarly: false });
  }

  static validateLogout(data) {
    return auth.LogoutScheme.validate(data, { abortEarly: false });
  }

  static validateVerify2FA(data) {
    return auth.Verify2FAScheme.validate(data, { abortEarly: false });
  }

  static validateUpdateProfile(data) {
    return user.UpdateProfileScheme.validate(data, { abortEarly: false });
  }

  static validateUploadAvatar(data) {
    return user.UploadAvatarScheme.validate(data, { abortEarly: false });
  }

  // Notification
  static validateGetNotifications(data) {
    return notification.GetNotificationsScheme.validate(data, { abortEarly: false });
  }

  static validateMarkAsRead(data) {
    return notification.MarkAsReadScheme.validate(data, { abortEarly: false });
  }

  static validateDeleteNotification(data) {
    return notification.DeleteNotificationScheme.validate(data, { abortEarly: false });
  }

  // News — Articles
  static validateCreateArticle(data) {
    return news.CreateArticleScheme.validate(data, { abortEarly: false });
  }

  static validateUpdateArticle(data) {
    return news.UpdateArticleScheme.validate(data, { abortEarly: false });
  }

  static validateDeleteArticle(data) {
    return news.DeleteArticleScheme.validate(data, { abortEarly: false });
  }

  static validateGetArticle(data) {
    return news.GetArticleScheme.validate(data, { abortEarly: false });
  }

  static validateListArticles(data) {
    return news.ListArticlesScheme.validate(data, { abortEarly: false });
  }

  static validateSearchArticles(data) {
    return news.SearchArticlesScheme.validate(data, { abortEarly: false });
  }

  // News — Categories
  static validateCreateCategory(data) {
    return news.CreateCategoryScheme.validate(data, { abortEarly: false });
  }

  static validateUpdateCategory(data) {
    return news.UpdateCategoryScheme.validate(data, { abortEarly: false });
  }

  static validateDeleteCategory(data) {
    return news.DeleteCategoryScheme.validate(data, { abortEarly: false });
  }

  // News — Media
  static validateGetUploadUrl(data) {
    return news.GetUploadUrlScheme.validate(data, { abortEarly: false });
  }

  // Admin — Articles
  static validateAdminCreateArticle(data) {
    return admin.AdminCreateArticleScheme.validate(data, { abortEarly: false });
  }

  static validateAdminDeleteArticle(data) {
    return admin.AdminDeleteArticleScheme.validate(data, { abortEarly: false });
  }

  // Admin — Notifications
  static validateAdminSendNotification(data) {
    return admin.AdminSendNotificationScheme.validate(data, { abortEarly: false });
  }

  static validateAdminSendBulkNotification(data) {
    return admin.AdminSendBulkNotificationScheme.validate(data, { abortEarly: false });
  }
}
