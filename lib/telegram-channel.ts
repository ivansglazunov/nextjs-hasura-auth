import Debug from './debug';
import FormData from 'form-data'; // Required for sending files (photo)
import fetch from 'node-fetch'; // Ensure node-fetch is used for consistent API in Node.js

const debug = Debug('telegram:channel');

async function callTelegramApi(botToken: string, methodName: string, params: Record<string, any>) {
  const apiUrl = `https://api.telegram.org/bot${botToken}/${methodName}`;
  debug(`Calling Telegram API: ${methodName} with params:`, params);
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const responseData = await response.json() as any; // Cast to any for broader compatibility
    if (!response.ok || !responseData.ok) {
      debug('Telegram API Error:', responseData);
      throw new Error(`Telegram API Error (${methodName}): ${responseData.description || 'Unknown error'} [${responseData.error_code || response.status}]`);
    }
    debug('Telegram API Success:', responseData.result);
    return responseData.result;
  } catch (error) {
    debug(`Error calling Telegram API (${methodName}):`, error);
    throw error;
  }
}

export async function setTelegramChannelTitle(botToken: string, channelId: string, title: string): Promise<boolean> {
  try {
    await callTelegramApi(botToken, 'setChatTitle', { chat_id: channelId, title });
    return true;
  } catch (error) {
    console.error(`Failed to set Telegram channel title for ${channelId}:`, error);
    return false;
  }
}

export async function setTelegramChannelPhoto(botToken: string, channelId: string, photoBuffer: Buffer, fileName: string = 'logo.png'): Promise<boolean> {
  const apiUrl = `https://api.telegram.org/bot${botToken}/setChatPhoto`;
  debug(`Setting Telegram channel photo for ${channelId} using ${fileName}`);
  try {
    const formData = new FormData();
    formData.append('chat_id', channelId);
    formData.append('photo', photoBuffer, { filename: fileName, contentType: 'image/png' });

    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      // headers: formData.getHeaders() // form-data library handles this
    });

    const responseData = await response.json() as any;
    if (!response.ok || !responseData.ok) {
      debug('Telegram API Error (setChatPhoto):', responseData);
      throw new Error(`Telegram API Error (setChatPhoto): ${responseData.description || 'Unknown error'} [${responseData.error_code || response.status}]`);
    }
    debug('Telegram channel photo set successfully:', responseData.result);
    return true;
  } catch (error) {
    console.error(`Failed to set Telegram channel photo for ${channelId}:`, error);
    debug('Error setting channel photo:', error);
    return false;
  }
} 