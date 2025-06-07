// spotify oauth token refresh handling
import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// initialize Firebase Admin 
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  

  const authHeader = req.headers.authorization;
  

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  

  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    // verify the Firebase ID token
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    
    // get refresh token from request body
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Missing refresh token' });
    }
    

    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Error refreshing token:', errorData);
      return res.status(500).json({ error: 'Failed to refresh token' });
    }
    
    const tokenData = await tokenResponse.json();
    
    // calculate expiration time
    const expiresAt = Date.now() + tokenData.expires_in * 1000;
    
    // create the updated tokens object
    const updatedTokens = {
      ...tokenData,
      refresh_token: tokenData.refresh_token || refreshToken, // Use new refresh token if provided, else use old one
      expiresAt,
    };
    
    await db.collection('users').doc(uid).update({
      'spotify.tokens': updatedTokens,
    });
    
    // return the new tokens to the client
    return res.status(200).json(updatedTokens);
  } catch (error) {
    console.error('Error refreshing Spotify token:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
} 