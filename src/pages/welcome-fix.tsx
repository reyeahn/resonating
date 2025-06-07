// alternative welcome screen implementation
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { useAuth } from '../hooks/useAuth';
import Container from '../components/layout/Container';
import LoginForm from '../components/auth/LoginForm';
import SignupForm from '../components/auth/SignupForm';

type AuthMode = 'login' | 'signup' | 'forgot-password';

const Welcome: React.FC = () => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn, signUp, googleSignIn, resetUserPassword } = useAuth();
  const router = useRouter();

  const handleLogin = async (email: string, password: string) => {
    console.log(' Login attempt with email:', email);
    setIsLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      router.push('/onboarding');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (name: string, email: string, password: string) => {
    console.log(' Signup attempt initiated with:');
    console.log('- Name:', name);
    console.log('- Email:', email);
    console.log('- Password length:', password.length);
    
    setIsLoading(true);
    setError(null);
    
    // verify the email format before sending
    if (!email || !email.includes('@')) {
      console.error(' Invalid email format in Welcome component:', email);
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }
    
    try {
      console.log(' Calling signUp hook with:', name, email);
      
      await signUp(email, password, name);
      
      router.push('/onboarding');
    } catch (err: any) {
      console.error(' Signup error:', err);
      setError(err.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await googleSignIn();
      router.push('/onboarding');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (email: string) => {
    console.log(' Password reset attempt with email:', email);
    setIsLoading(true);
    setError(null);
    try {
      await resetUserPassword(email);
      alert('Password reset email sent. Please check your inbox.');
      setAuthMode('login');
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAuthMode = (mode: AuthMode) => {
    setError(null);
    setAuthMode(mode);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-light-100 to-light-300 dark:from-dark-100 dark:to-dark flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <Container maxWidth="md">
        <div className="text-center mb-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-primary-600 flex items-center justify-center">
              {/*  */}
              <span className="text-3xl font-bold text-white">MC</span>
            </div>
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">
            MusicConnect
          </h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
            Connect with others through the music you love
          </p>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Auth forms */}
        <div className="bg-white dark:bg-dark-200 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {authMode === 'login' && (
            <LoginForm
              onLogin={handleLogin}
              onGoogleSignIn={handleGoogleSignIn}
              onForgotPassword={() => toggleAuthMode('forgot-password')}
              onSignUpClick={() => toggleAuthMode('signup')}
              isLoading={isLoading}
            />
          )}

          {authMode === 'signup' && (
            <SignupForm
              onSignUp={handleSignUp}
              onGoogleSignIn={handleGoogleSignIn}
              onLoginClick={() => toggleAuthMode('login')}
              isLoading={isLoading}
            />
          )}

          {authMode === 'forgot-password' && (
            <div className="w-full max-w-md space-y-6">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Reset Password</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Enter your email address and we'll send you a link to reset your password
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value;
                  handleForgotPassword(email);
                }}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:bg-dark-100 dark:border-dark-300 dark:text-light-300"
                    placeholder="your@email.com"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleAuthMode('login')}
                    className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
                  >
                    Back to login
                  </button>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Processing...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </Container>
    </div>
  );
};

export default Welcome; 