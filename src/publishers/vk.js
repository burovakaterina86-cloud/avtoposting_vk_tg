import axios from 'axios';
import { logger } from '../logger.js';

const VK_API_BASE = 'https://api.vk.com/method';

/**
 * Upload image to VK wall by URL.
 * Steps: getWallUploadServer → download image → upload to VK → saveWallPhoto.
 * @returns {string} attachment string like "photo{owner_id}_{photo_id}"
 */
async function uploadPhotoToVk(imageUrl, vkConfig) {
  const { accessToken, groupId } = vkConfig;
  const gid = String(groupId).replace(/^-/, '');

  // 1. Get upload server
  const { data: serverData } = await axios.get(`${VK_API_BASE}/photos.getWallUploadServer`, {
    params: { access_token: accessToken, group_id: gid, v: '5.131' },
    timeout: 15_000,
  });
  if (serverData.error) {
    throw new Error(`VK getWallUploadServer: ${serverData.error.error_msg}`);
  }
  const uploadUrl = serverData.response.upload_url;

  // 2. Download image as buffer
  const { data: imageBuffer } = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30_000,
  });

  // 3. Upload to VK (multipart/form-data via native FormData)
  const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
  const form = new FormData();
  form.append('photo', blob, 'photo.jpg');

  const uploadResponse = await fetch(uploadUrl, { method: 'POST', body: form });
  const uploadResult = await uploadResponse.json();

  if (!uploadResult.photo || uploadResult.photo === '[]') {
    throw new Error('VK photo upload returned empty result');
  }

  // 4. Save wall photo
  const { data: saveData } = await axios.get(`${VK_API_BASE}/photos.saveWallPhoto`, {
    params: {
      access_token: accessToken,
      group_id: gid,
      server: uploadResult.server,
      photo: uploadResult.photo,
      hash: uploadResult.hash,
      v: '5.131',
    },
    timeout: 15_000,
  });
  if (saveData.error) {
    throw new Error(`VK saveWallPhoto: ${saveData.error.error_msg}`);
  }

  const saved = saveData.response[0];
  return `photo${saved.owner_id}_${saved.id}`;
}

/**
 * Post to VK group wall with optional image.
 * @param {{ text: string, imageUrl?: string }} post
 * @param {import('../config.js').config['vk']} vkConfig
 */
export async function publishToVk(post, vkConfig) {
  const { accessToken, groupId } = vkConfig;

  try {
    // Upload photo if imageUrl provided
    let attachments = '';
    if (post.imageUrl) {
      try {
        attachments = await uploadPhotoToVk(post.imageUrl, vkConfig);
        logger.info({ attachments }, '[VK] photo uploaded');
      } catch (uploadErr) {
        logger.warn({ err: uploadErr.message }, '[VK] photo upload failed, posting text only');
      }
    }

    const params = new URLSearchParams({
      access_token: accessToken,
      owner_id: `-${String(groupId).replace(/^-/, '')}`,
      message: post.text,
      v: '5.131',
    });
    if (attachments) {
      params.set('attachments', attachments);
    }

    const { data } = await axios.post(`${VK_API_BASE}/wall.post?${params.toString()}`, null, { timeout: 15_000 });
    if (data?.error) {
      logger.error({ error: data.error, groupId }, '[VK] wall.post API error');
      throw new Error(data.error.error_msg || 'VK API error');
    }
    logger.info({ groupId, hasImage: !!attachments }, '[VK] post published');
  } catch (err) {
    logger.error({ err: err.message, groupId }, '[VK] publish failed');
    throw err;
  }
}
