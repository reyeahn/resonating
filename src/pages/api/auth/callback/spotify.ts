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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, error, state } = req.query;

  // handle Spotify auth error
  if (error) {
    console.error('Spotify auth error:', error);
    return res.redirect(`/settings?error=${error}`);
  }

  // ensure auth code was provided
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    // exchange authorization code for access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/spotify',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Error exchanging code for token:', errorData);
      return res.redirect('/settings?error=token_exchange_failed');
    }

    const tokenData = await tokenResponse.json();

    // get Spotify user profile to match with our user
    const profileResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      console.error('Error fetching Spotify profile');
      return res.redirect('/settings?error=profile_fetch_failed');
    }

    const profileData = await profileResponse.json();

    // verify the Firebase ID token in cookie or session
    const idToken = req.cookies.firebaseToken;
    
    if (!idToken) {
      return res.redirect('/login?redirect=/settings&error=authentication_required');
    }

    try {
      const decodedToken = await getAuth().verifyIdToken(idToken);
      const uid = decodedToken.uid;

      // calculate token expiration time
      const expiresAt = Date.now() + tokenData.expires_in * 1000;

      // store Spotify tokens and profile in user document
      await db.collection('users').doc(uid).update({
        spotify: {
          tokens: {
            ...tokenData,
            expiresAt,
          },
          profile: {
            id: profileData.id,
            displayName: profileData.display_name,
            email: profileData.email,
            images: profileData.images,
            country: profileData.country,
            product: profileData.product,
          },
        },
        spotifyConnected: true,
      });

      // redirect to settings page 
      return res.redirect('/settings?success=spotify_connected');
    } catch (error) {
      console.error('Error verifying Firebase token:', error);
      return res.redirect('/login?redirect=/settings&error=authentication_required');
    }
  } catch (error) {
    console.error('Error in Spotify callback:', error);
    return res.redirect('/settings?error=server_error');
  }
} 