// spotify client credentials management
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log(' CLIENT-TOKEN: Starting client credentials flow');
    
    // get client credentials from environment variables
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    console.log('CLIENT-TOKEN: Environment check:', { 
      hasClientId: !!clientId, 
      hasClientSecret: !!clientSecret,
      clientIdLength: clientId?.length || 0,
      clientSecretLength: clientSecret?.length || 0
    });

    if (!clientId || !clientSecret) {
      console.error('🎵 CLIENT-TOKEN: Missing Spotify credentials');
      return res.status(500).json({ error: 'Spotify credentials not configured' });
    }

    console.log('CLIENT-TOKEN: Making token request to Spotify...');

    // exchange client credentials for access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
      }),
    });

    console.log(' CLIENT-TOKEN: Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('CLIENT-TOKEN: Error getting Spotify client token:', errorData);
      return res.status(500).json({ error: 'Failed to get Spotify token' });
    }

    const tokenData = await tokenResponse.json();
    console.log('CLIENT-TOKEN: Token obtained successfully');
    
    // return token to client (the token doesn't allow access to user data)
    return res.status(200).json(tokenData);
  } catch (error) {
    console.error(' CLIENT-TOKEN: Error in client-token endpoint:', error);
    return res.status(500).json({ error: 'Server error' });
  }
} 