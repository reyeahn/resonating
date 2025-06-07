/**
 * 
 * 
 * set up Firebase configuration
 * 
 */

// firebase project initialization script

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const envFilePath = path.join(__dirname, '..', '.env.local');
const envExamplePath = path.join(__dirname, '..', 'env.example');

// check if .env.local already exists
if (fs.existsSync(envFilePath)) {
  console.log('\x1b[33m%s\x1b[0m', '.env.local file already exists. Do you want to overwrite it? (y/n)');
  rl.question('', (answer) => {
    if (answer.toLowerCase() === 'y') {
      promptForCredentials();
    } else {
      console.log('\x1b[32m%s\x1b[0m', 'Setup cancelled. Existing .env.local file preserved.');
      rl.close();
    }
  });
} else {
  promptForCredentials();
}

function promptForCredentials() {
  console.log('\x1b[36m%s\x1b[0m', '===== MusicConnect Firebase Setup =====');
  console.log('Please enter your Firebase project credentials:');
  console.log('(You can find these in the Firebase console under Project Settings > General > Your apps > SDK setup and configuration)');
  console.log('');

  const credentials = {};

  const questions = [
    { key: 'NEXT_PUBLIC_FIREBASE_API_KEY', message: 'Firebase API Key:' },
    { key: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', message: 'Firebase Auth Domain:' },
    { key: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', message: 'Firebase Project ID:' },
    { key: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', message: 'Firebase Storage Bucket:' },
    { key: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', message: 'Firebase Messaging Sender ID:' },
    { key: 'NEXT_PUBLIC_FIREBASE_APP_ID', message: 'Firebase App ID:' },
  ];

  const askQuestion = (index) => {
    if (index >= questions.length) {
      // All questions answered
      console.log('\n\x1b[36m%s\x1b[0m', 'Do you want to configure Spotify API credentials now? (y/n)');
      rl.question('', (answer) => {
        if (answer.toLowerCase() === 'y') {
          askSpotifyCredentials(credentials);
        } else {
          createEnvFile(credentials);
        }
      });
      return;
    }

    rl.question(`${questions[index].message} `, (answer) => {
      credentials[questions[index].key] = answer;
      askQuestion(index + 1);
    });
  };

  askQuestion(0);
}

function askSpotifyCredentials(credentials) {
  console.log('\n\x1b[36m%s\x1b[0m', '===== Spotify API Setup =====');
  console.log('Please enter your Spotify Developer credentials:');
  console.log('(You can find these in the Spotify Developer Dashboard)');
  console.log('');

  rl.question('Spotify Client ID: ', (clientId) => {
    credentials['NEXT_PUBLIC_SPOTIFY_CLIENT_ID'] = clientId;
    
    rl.question('Spotify Client Secret: ', (clientSecret) => {
      credentials['SPOTIFY_CLIENT_SECRET'] = clientSecret;
      
      rl.question('Spotify Redirect URI (default: http://localhost:3000/api/auth/callback/spotify): ', (redirectUri) => {
        credentials['SPOTIFY_REDIRECT_URI'] = redirectUri || 'http://localhost:3000/api/auth/callback/spotify';
        
        createEnvFile(credentials);
      });
    });
  });
}

function createEnvFile(credentials) {
  fs.readFile(envExamplePath, 'utf8', (err, data) => {
    if (err) {
      console.error('\x1b[31m%s\x1b[0m', 'Error reading env.example file:', err);
      rl.close();
      return;
    }

    
    let envContent = data;
    Object.keys(credentials).forEach(key => {
      const regex = new RegExp(`${key}=.*`, 'g');
      envContent = envContent.replace(regex, `${key}=${credentials[key]}`);
    });

    // write to .env.local
    fs.writeFile(envFilePath, envContent, 'utf8', (err) => {
      if (err) {
        console.error('\x1b[31m%s\x1b[0m', 'Error writing .env.local file:', err);
        rl.close();
        return;
      }

      console.log('\n\x1b[32m%s\x1b[0m', 'Successfully created .env.local file with your credentials!');
      console.log('\x1b[32m%s\x1b[0m', 'You can now start the application with: npm run dev');
      
      rl.close();
    });
  });
} 