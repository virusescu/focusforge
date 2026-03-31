import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token: string;
  expires_in: number;
  token_type: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export interface StoredAuth {
  refresh_token: string;
  google_sub: string;
}

export async function startOAuthFlow(): Promise<{ userInfo: GoogleUserInfo; refreshToken: string }> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;

  // Get an available port for the callback
  const port: number = await invoke('get_available_port');
  const redirectUri = `http://localhost:${port}`;

  // Build the auth URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });

  const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;

  // Start listening for the callback BEFORE opening the browser
  const codePromise: Promise<string> = invoke('wait_for_oauth_callback', { port });

  // Open the browser
  await open(authUrl);

  // Wait for the callback
  const code = await codePromise;

  // Exchange the code for tokens
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: decodeURIComponent(code),
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokens: GoogleTokenResponse = await tokenResponse.json();

  // Get user info
  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userInfoResponse.ok) {
    throw new Error('Failed to fetch user info');
  }

  const userInfo: GoogleUserInfo = await userInfoResponse.json();

  return {
    userInfo,
    refreshToken: tokens.refresh_token || '',
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; userInfo: GoogleUserInfo }> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Token refresh failed — user must re-authenticate');
  }

  const tokens: GoogleTokenResponse = await tokenResponse.json();

  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userInfoResponse.ok) {
    throw new Error('Failed to fetch user info');
  }

  const userInfo: GoogleUserInfo = await userInfoResponse.json();

  return { accessToken: tokens.access_token, userInfo };
}
