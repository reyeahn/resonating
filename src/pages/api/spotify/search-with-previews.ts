// enhanced search with audio previews
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { query, limit = 10 } = req.query;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter is required' });
  }
  
  try {
    console.log(' ENHANCED-API: Starting enhanced search for:', query);
    
    // get client credentials from environment variables
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.log(' ENHANCED-API: Missing Spotify credentials, cannot use preview finder');
      return res.status(200).json({ tracks: { items: [] } });
    }
    
    // first, try the standard Spotify API search
    try {
      console.log(' ENHANCED-API: Trying standard Spotify API first...');
      
      // get client credentials token directly
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

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json();
        
        const searchResponse = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
          {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
            },
          }
        );
        
        if (searchResponse.ok) {
          const standardData = await searchResponse.json();
          const standardTracks = standardData.tracks?.items || [];
          console.log(' ENHANCED-API: Standard Spotify API returned:', standardTracks.length, 'tracks');
          
          if (standardTracks.length > 0) {
            // enhance existing tracks with preview finder 
            console.log(' ENHANCED-API: Enhancing tracks with preview finder...');
            
            const enhancedTracks = await Promise.all(
              standardTracks.map(async (track: any) => {

                if (track.preview_url) {
                  console.log(` ENHANCED-API: Track "${track.name}" already has preview URL`);
                  return track;
                }
                
                try {

                  const spotifyPreviewFinder = require('spotify-preview-finder');
                  const searchQuery = `${track.name} ${track.artists[0]?.name || ''}`.trim();
                  const previewResult = await spotifyPreviewFinder(searchQuery, 1);
                  
                  if (previewResult.success && previewResult.results.length > 0) {
                    const previewUrl = previewResult.results[0].previewUrls[0];
                    console.log(` ENHANCED-API: Found preview URL for "${track.name}"`);
                    
                    return {
                      ...track,
                      preview_url: previewUrl
                    };
                  } else {
                    console.log(` ENHANCED-API: No preview found for "${track.name}"`);
                    return track;
                  }
                } catch (error) {
                  console.log(` ENHANCED-API: Error finding preview for "${track.name}":`, error);
                  return track;
                }
              })
            );
            
            const tracksWithPreviews = enhancedTracks.filter((t: any) => t.preview_url).length;
            console.log(' ENHANCED-API: Enhanced search complete. Tracks with previews:', 
              tracksWithPreviews, 'out of', enhancedTracks.length);
            
            return res.status(200).json({ tracks: { items: enhancedTracks } });
          }
        } else {
          console.log(' ENHANCED-API: Standard Spotify API failed:', searchResponse.status);
        }
      } else {
        console.log(' ENHANCED-API: Token request failed:', tokenResponse.status);
      }
    } catch (standardError) {
      console.log(' ENHANCED-API: Standard Spotify API error:', standardError);
    }
    
    console.log(' ENHANCED-API: Trying preview finder only...');
    
    try {
      const spotifyPreviewFinder = require('spotify-preview-finder');
      const previewResult = await spotifyPreviewFinder(query, parseInt(limit.toString()));
      
      if (previewResult.success && previewResult.results.length > 0) {
        console.log(' ENHANCED-API: Preview finder returned:', previewResult.results.length, 'results');
        
        // convert preview finder results to Spotify track format 
        const enhancedTracks = previewResult.results.map((result: any) => {
          const nameParts = result.name.split(' - ');
          const trackName = nameParts[0] || result.name;
          const artistName = nameParts[1] || 'Unknown Artist';
          
          return {
            id: result.spotifyUrl.split('/').pop() || `preview_${Date.now()}`,
            name: trackName,
            album: {
              id: '',
              name: 'Unknown Album',
              images: [] // no album artwork fetching 
            },
            artists: [{
              id: '',
              name: artistName
            }],
            preview_url: result.previewUrls[0] || null,
            external_urls: {
              spotify: result.spotifyUrl
            },
            duration_ms: 30000
          };
        });
        
        return res.status(200).json({ tracks: { items: enhancedTracks } });
      } else {
        console.log('ENHANCED-API: Preview finder returned no results');
      }
    } catch (previewError) {
      console.log(' ENHANCED-API: Preview finder failed:', previewError);
    }
    
    return res.status(200).json({ tracks: { items: [] } });
    
  } catch (error) {
    console.error('ENHANCED-API: Error in enhanced search:', error);
    return res.status(500).json({ error: 'Failed to search with previews' });
  }
} 