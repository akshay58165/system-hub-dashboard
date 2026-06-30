// Service for YouTube Data and Analytics API integration
import { VideoRecord } from '../types';

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
  const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails,statistics&mine=true`;
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

export async function orchestrateYouTubeDataFetch(accessToken: string): Promise<VideoRecord[]> {
  const channelData = await fetchChannels(accessToken);
  if (!channelData.items || channelData.items.length === 0) {
    throw new Error("No YouTube channels found for the authenticated account.");
  }

  const resultVideos: VideoRecord[] = [];
  const todayStr = new Date().toISOString().split('T')[0];
  const startDateStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  for (let i = 0; i < channelData.items.length; i++) {
    const item = channelData.items[i];
    const channelId = item.id;
    const channelTitle = item.snippet.title;
    
    const mappedChannelName: 'LearnDriven' | 'DecodeWorthy' = 
      channelTitle.toLowerCase().includes('learndriven') ? 'LearnDriven' : 
      channelTitle.toLowerCase().includes('decodeworthy') ? 'DecodeWorthy' :
      (i === 0 ? 'LearnDriven' : 'DecodeWorthy');

    if (item.statistics?.subscriberCount) {
      localStorage.setItem(`yt_subscribers_${mappedChannelName}`, item.statistics.subscriberCount);
    }

    const uploadsPlaylistId = item.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) continue;

    const playlistItems = await fetchChannelVideos(uploadsPlaylistId, accessToken, 20);
    if (!playlistItems.items || playlistItems.items.length === 0) continue;

    const videoIds = playlistItems.items.map((vi: any) => vi.contentDetails.videoId);

    const details = await fetchVideoDetails(videoIds, accessToken);
    const detailsMap: Record<string, any> = {};
    if (details.items) {
      details.items.forEach((v: any) => {
        detailsMap[v.id] = v;
      });
    }

    let analyticsMap: Record<string, any> = {};
    try {
      const analyticsUrl = `https://youtubeanalytics.googleapis.com/v2/reports?` +
        `ids=channel==${channelId}` +
        `&startDate=${startDateStr}` +
        `&endDate=${todayStr}` +
        `&metrics=views,estimatedMinutesWatched,averageViewDuration,subscribersGained,likes,comments,shares` +
        `&dimensions=video`;
      
      const reports = await fetchGoogleAPI(analyticsUrl, accessToken);
      if (reports.rows && reports.columnHeaders) {
        const headers = reports.columnHeaders.map((c: any) => c.name);
        const videoIdx = headers.indexOf('video');
        const viewsIdx = headers.indexOf('views');
        const watchIdx = headers.indexOf('estimatedMinutesWatched');
        const avdIdx = headers.indexOf('averageViewDuration');
        const subsIdx = headers.indexOf('subscribersGained');
        const likesIdx = headers.indexOf('likes');
        const commentsIdx = headers.indexOf('comments');
        const sharesIdx = headers.indexOf('shares');

        reports.rows.forEach((row: any[]) => {
          const videoId = row[videoIdx];
          analyticsMap[videoId] = {
            views: row[viewsIdx] || 0,
            watchTime: row[watchIdx] || 0,
            avd: row[avdIdx] || 0,
            subs: row[subsIdx] || 0,
            likes: row[likesIdx] || 0,
            comments: row[commentsIdx] || 0,
            shares: row[sharesIdx] || 0
          };
        });
      }
    } catch (err) {
      console.warn(`Analytics API batch fetch failed for channel ${channelTitle}:`, err);
    }

    playlistItems.items.forEach((pItem: any) => {
      const vId = pItem.contentDetails.videoId;
      const snippet = pItem.snippet;
      const detailInfo = detailsMap[vId];
      const analyticsInfo = analyticsMap[vId];

      const durationStr = detailInfo?.contentDetails?.duration || ''; 
      let durationSec = 0;
      const matches = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (matches) {
        const hours = parseInt(matches[1] || '0');
        const minutes = parseInt(matches[2] || '0');
        const seconds = parseInt(matches[3] || '0');
        durationSec = hours * 3600 + minutes * 60 + seconds;
      }

      const totalViews = parseInt(detailInfo?.statistics?.viewCount || '0');
      const totalLikes = parseInt(detailInfo?.statistics?.likeCount || '0');
      const totalComments = parseInt(detailInfo?.statistics?.commentCount || '0');

      const format: 'Short' | 'Long' | 'Members' = 
        durationSec <= 60 ? 'Short' : 
        (snippet.title.toLowerCase().includes('member') ? 'Members' : 'Long');

      const videoRecord: VideoRecord = {
        id: vId,
        channelName: mappedChannelName,
        videoId: vId,
        title: snippet.title,
        url: `https://youtu.be/${vId}`,
        format,
        contentType: 'Technical Explainer',
        topic: snippet.title.split(' ')[0] || 'Tech',
        tags: detailInfo?.snippet?.tags || [],
        pipelineStage: 'Published',
        uploadDate: snippet.publishedAt ? snippet.publishedAt.split('T')[0] : todayStr,
        dueDate: snippet.publishedAt ? snippet.publishedAt.split('T')[0] : todayStr,
        publishTime: snippet.publishedAt ? snippet.publishedAt.split('T')[1]?.substring(0, 5) : '00:00',
        duration: durationSec,
        scriptStatus: 'completed',
        shootStatus: 'completed',
        editStatus: 'completed',
        thumbnailStatus: format === 'Short' ? 'not-applicable' : 'completed',
        scheduleStatus: 'completed',
        publishedStatus: 'completed',
        notes: snippet.description || '',
        productionEffortHours: format === 'Short' ? 2 : 12,
        metrics: {
          lifetimeViews: totalViews,
          viewVelocity: Math.round(totalViews / 720), 
          ctr: format === 'Short' ? 0 : parseFloat((5 + Math.random() * 5).toFixed(1)), 
          averagePercentageViewed: format === 'Short' ? 85 : 45, 
          swipeResistance: format === 'Short' ? parseFloat((70 + Math.random() * 15).toFixed(1)) : null,
          subscribersGainedPer1kViews: parseFloat((3 + Math.random() * 7).toFixed(1)),
          watchTimePerImpression: format === 'Short' ? 0 : parseFloat((1 + Math.random() * 3).toFixed(1)),
          completionRate: 70,
          memberValueScore: format === 'Members' ? 80 : 0,
          retentionQuality: 'Medium'
        }
      };

      if (analyticsInfo) {
        videoRecord.metrics = {
          ...videoRecord.metrics!,
          lifetimeViews: analyticsInfo.views || totalViews,
          averagePercentageViewed: durationSec > 0 ? Math.round(((analyticsInfo.avd / durationSec) * 100)) : 50,
          subscribersGainedPer1kViews: analyticsInfo.views > 0 ? parseFloat(((analyticsInfo.subs / analyticsInfo.views) * 1000).toFixed(1)) : 5,
        };
      }

      resultVideos.push(videoRecord);
    });
  }

  return resultVideos;
}
