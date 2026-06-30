// Service for YouTube Data and Analytics API integration

const CLIENT_ID = (import.meta as any).env.VITE_YOUTUBE_CLIENT_ID || '';
const REDIRECT_URI = window.location.origin; // e.g. http://localhost:3000

export interface YouTubeCredentials {
  accessToken: string;
  expiresAt: number;
}

// Check if credentials exist and are not expired
export function getYouTubeCredentials(): YouTubeCredentials | null {
  const stored = localStorage.getItem('yt_oauth_credentials');
  if (!stored) return null;
  
  try {
    const creds = JSON.parse(stored) as YouTubeCredentials;
    if (Date.now() > creds.expiresAt) {
      localStorage.removeItem('yt_oauth_credentials');
      return null;
    }
    return creds;
  } catch (e) {
    return null;
  }
}

// Redirect user to Google OAuth 2.0 Consent Screen (Implicit Flow)
export function loginWithYouTube() {
  if (!CLIENT_ID) {
    alert("VITE_YOUTUBE_CLIENT_ID is not configured in your .env.local file.");
    return;
  }

  const scopes = [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly'
  ];

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
    `client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent(scopes.join(' '))}` +
    `&include_granted_scopes=true` +
    `&state=youtube_oauth`;

  window.location.href = authUrl;
}

// Parse Access Token from callback URL hash
export function handleOAuthCallback(): YouTubeCredentials | null {
  const hash = window.location.hash;
  if (!hash) return null;

  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  const expiresIn = params.get('expires_in');
  const state = params.get('state');

  if (accessToken && state === 'youtube_oauth') {
    const credentials = {
      accessToken,
      expiresAt: Date.now() + parseInt(expiresIn || '3600') * 1000
    };
    localStorage.setItem('yt_oauth_credentials', JSON.stringify(credentials));
    // Clean URL hash
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return credentials;
  }
  return null;
}

export function logoutYouTube() {
  localStorage.removeItem('yt_oauth_credentials');
}

// Call Google API helper
async function fetchGoogleAPI(endpoint: string, accessToken: string) {
  const response = await fetch(endpoint, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// Fetch channels linked to authenticated Google Account
export async function fetchChannels(accessToken: string) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true`;
  return fetchGoogleAPI(url, accessToken);
}

// Fetch uploads for a specific channel
export async function fetchChannelVideos(uploadsListId: string, accessToken: string, maxResults = 25) {
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsListId}&maxResults=${maxResults}`;
  return fetchGoogleAPI(url, accessToken);
}

// Fetch detailed metadata for a list of video IDs
export async function fetchVideoDetails(videoIds: string[], accessToken: string) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds.join(',')}`;
  return fetchGoogleAPI(url, accessToken);
}

// Fetch YouTube Analytics reports for a specific video ID
export async function fetchVideoAnalytics(channelId: string, videoId: string, startDate: string, endDate: string, accessToken: string) {
  const url = `https://youtubeanalytics.googleapis.com/v2/reports?` +
    `ids=channel==${channelId}` +
    `&startDate=${startDate}` +
    `&endDate=${endDate}` +
    `&metrics=views,estimatedMinutesWatched,averageViewDuration,subscribersGained,likes,comments,shares` +
    `&dimensions=video` +
    `&filters=video==${videoId}`;

  return fetchGoogleAPI(url, accessToken);
}
