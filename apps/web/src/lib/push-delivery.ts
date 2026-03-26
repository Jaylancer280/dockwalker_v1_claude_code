import type { SupabaseClient } from '@supabase/supabase-js';

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send a push notification to all registered devices for a given person.
 * Queries device_tokens, dispatches per platform, and cleans up invalid tokens.
 *
 * No-ops gracefully when push credentials are not configured (local dev).
 */
export async function sendPushToUser(
  serviceClient: SupabaseClient,
  personId: string,
  notification: PushNotification,
): Promise<void> {
  const { data: tokens, error } = await serviceClient
    .from('device_tokens')
    .select('id, token, platform')
    .eq('person_id', personId);

  if (error || !tokens || tokens.length === 0) return;

  const invalidTokenIds: string[] = [];

  await Promise.allSettled(
    tokens.map(async (row) => {
      const result =
        row.platform === 'apns'
          ? await sendToApns(row.token, notification)
          : await sendToFcm(row.token, notification);

      if (result === 'invalid_token') {
        invalidTokenIds.push(row.id);
      }
    }),
  );

  if (invalidTokenIds.length > 0) {
    await serviceClient.from('device_tokens').delete().in('id', invalidTokenIds);
  }
}

type DeliveryResult = 'sent' | 'invalid_token' | 'error' | 'not_configured';

// ---------- FCM HTTP v1 ----------

let fcmAccessToken: string | null = null;
let fcmTokenExpiry = 0;

async function getFcmAccessToken(): Promise<string | null> {
  const keyJson = process.env.FCM_SERVICE_ACCOUNT_KEY;
  if (!keyJson) return null;

  if (fcmAccessToken && Date.now() < fcmTokenExpiry) return fcmAccessToken;

  try {
    const sa = JSON.parse(keyJson) as {
      client_email: string;
      private_key: string;
      token_uri: string;
    };

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: sa.token_uri,
        iat: now,
        exp: now + 3600,
      }),
    ).toString('base64url');

    const { createSign } = await import('crypto');
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${payload}`);
    const signature = signer.sign(sa.private_key, 'base64url');

    const jwt = `${header}.${payload}.${signature}`;

    const res = await fetch(sa.token_uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!res.ok) return null;

    const tokenData = (await res.json()) as { access_token: string; expires_in: number };
    fcmAccessToken = tokenData.access_token;
    fcmTokenExpiry = Date.now() + (tokenData.expires_in - 60) * 1000;
    return fcmAccessToken;
  } catch {
    return null;
  }
}

async function sendToFcm(token: string, notification: PushNotification): Promise<DeliveryResult> {
  const projectId = process.env.FCM_PROJECT_ID;
  if (!projectId) return 'not_configured';

  const accessToken = await getFcmAccessToken();
  if (!accessToken) return 'not_configured';

  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: notification.title, body: notification.body },
          data: notification.data,
        },
      }),
    });

    if (res.ok) return 'sent';

    const body = (await res.json()) as { error?: { details?: Array<{ errorCode?: string }> } };
    const errorCode = body?.error?.details?.[0]?.errorCode;
    if (errorCode === 'UNREGISTERED' || errorCode === 'INVALID_ARGUMENT') {
      return 'invalid_token';
    }

    return 'error';
  } catch {
    return 'error';
  }
}

// ---------- APNs HTTP/2 ----------

let apnsJwt: string | null = null;
let apnsJwtExpiry = 0;

async function getApnsJwt(): Promise<string | null> {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const keyPath = process.env.APNS_KEY_PATH;
  if (!keyId || !teamId || !keyPath) return null;

  if (apnsJwt && Date.now() < apnsJwtExpiry) return apnsJwt;

  try {
    const { readFileSync } = await import('fs');
    const { createSign } = await import('crypto');

    const key = readFileSync(keyPath, 'utf8');
    const now = Math.floor(Date.now() / 1000);

    const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iss: teamId, iat: now })).toString('base64url');

    const signer = createSign('SHA256');
    signer.update(`${header}.${payload}`);
    const signature = signer.sign({ key, dsaEncoding: 'ieee-p1363' }, 'base64url');

    apnsJwt = `${header}.${payload}.${signature}`;
    apnsJwtExpiry = Date.now() + 50 * 60 * 1000; // refresh every 50 min (APNs allows 60)
    return apnsJwt;
  } catch {
    throw new Error('[Push] Failed to read APNs key or sign JWT');
  }
}

async function sendToApns(token: string, notification: PushNotification): Promise<DeliveryResult> {
  const bundleId = process.env.APNS_BUNDLE_ID;
  if (!bundleId) return 'not_configured';

  const jwt = await getApnsJwt();
  if (!jwt) return 'not_configured';

  const isProduction = process.env.NODE_ENV === 'production';
  const host = isProduction ? 'api.push.apple.com' : 'api.sandbox.push.apple.com';

  try {
    const http2 = await import('http2');
    return await new Promise<DeliveryResult>((resolve) => {
      const client = http2.connect(`https://${host}`);

      client.on('error', () => {
        client.close();
        resolve('error');
      });

      const apnsPayload = JSON.stringify({
        aps: {
          alert: { title: notification.title, body: notification.body },
          sound: 'default',
        },
        ...(notification.data ?? {}),
      });

      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${token}`,
        authorization: `bearer ${jwt}`,
        'apns-topic': bundleId,
        'apns-push-type': 'alert',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(apnsPayload),
      });

      let responseData = '';
      let statusCode = 0;

      req.on('response', (headers) => {
        statusCode = headers[':status'] as number;
      });

      req.on('data', (chunk: Buffer) => {
        responseData += chunk.toString();
      });

      req.on('end', () => {
        client.close();

        if (statusCode === 200) {
          resolve('sent');
          return;
        }

        try {
          const body = JSON.parse(responseData) as { reason?: string };
          if (
            body.reason === 'BadDeviceToken' ||
            body.reason === 'Unregistered' ||
            body.reason === 'ExpiredToken'
          ) {
            resolve('invalid_token');
            return;
          }
        } catch {
          // parse failure — treat as generic error
        }

        resolve('error');
      });

      req.end(apnsPayload);
    });
  } catch {
    return 'not_configured';
  }
}
