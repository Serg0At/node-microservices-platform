import { getPresignedUploadUrl } from '../s3/s3Client.js';
import { JwtUtil } from '../utils/index.js';
import ErrorHandler from '../utils/error-handler.util.js';

const { errors } = ErrorHandler;

export default class MediaService {
  static async getUploadUrl({ access_token, filename, content_type, article_id }) {
    const decoded = JwtUtil.verifyAccessToken(access_token);
    if (decoded.role !== 1) throw new errors.Forbidden('Admin access required');

    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `articles/${article_id || 'general'}/${Date.now()}-${sanitized}`;

    const { uploadUrl, fileUrl, expiresIn } = await getPresignedUploadUrl(key, content_type);

    return {
      success: true,
      upload_url: uploadUrl,
      file_url: fileUrl,
      expires_in: expiresIn,
    };
  }
}
