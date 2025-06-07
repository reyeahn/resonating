// user login form with validation
import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { FaEnvelope, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';
import Button from '../common/Button';
import Input from '../common/Input';
import OAuthButtons from './OAuthButtons';

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
  onSpotifySignIn?: () => Promise<void>;
  onForgotPassword: () => void;
  onSignUpClick: () => void;
  isLoading?: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({
  onLogin,
  onGoogleSignIn,
  onSpotifySignIn,
  onForgotPassword,
  onSignUpClick,
  isLoading = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema: Yup.object({
      email: Yup.string()
        .email('Invalid email address')
        .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Must be a valid email format')
        .required('Email is required'),
      password: Yup.string()
        .required('Password is required'),
    }),
    onSubmit: async (values) => {
      console.log('Submitting login form with email:', values.email);
      try {
        await onLogin(values.email, values.password);
      } catch (error) {
        console.error('Login error:', error);
      }
    },
  });

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Sign in to your account to continue
        </p>
      </div>

      <OAuthButtons 
        onGoogleSignIn={onGoogleSignIn}
        onSpotifySignIn={onSpotifySignIn}
        isLoading={isLoading}
      />

      <form onSubmit={formik.handleSubmit} className="space-y-4">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          label="Email Address"
          placeholder="your@email.com"
          leftIcon={<FaEnvelope className="h-5 w-5 text-gray-400" />}
          value={formik.values.email}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.email && formik.errors.email ? formik.errors.email : undefined}
          disabled={isLoading}
        />

        <Input
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          label="Password"
          placeholder="********"
          leftIcon={<FaLock className="h-5 w-5 text-gray-400" />}
          rightIcon={
            <button
              type="button"
              onClick={togglePasswordVisibility}
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              {showPassword ? (
                <FaEyeSlash className="h-5 w-5" />
              ) : (
                <FaEye className="h-5 w-5" />
              )}
            </button>
          }
          value={formik.values.password}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.password && formik.errors.password ? formik.errors.password : undefined}
          disabled={isLoading}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Remember me
            </label>
          </div>

          <button
            type="button"
            onClick={onForgotPassword}
            className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
          >
            Forgot password?
          </button>
        </div>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          isLoading={isLoading}
        >
          Sign in
        </Button>
      </form>

      <div className="text-center mt-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSignUpClick}
            className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginForm; 