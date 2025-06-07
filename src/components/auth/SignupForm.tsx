// user registration form with validation
import React, { useState } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { FaUser, FaEnvelope, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';
import Button from '../common/Button';
import Input from '../common/Input';
import OAuthButtons from './OAuthButtons';

interface SignupFormProps {
  onSignUp: (name: string, email: string, password: string) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
  onSpotifySignIn?: () => Promise<void>;
  onLoginClick: () => void;
  isLoading?: boolean;
}

const SignupForm: React.FC<SignupFormProps> = ({
  onSignUp,
  onGoogleSignIn,
  onSpotifySignIn,
  onLoginClick,
  isLoading = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const formik = useFormik({
    initialValues: {
      name: '',
      email: '',
      password: '',
      acceptTerms: false,
    },
    validationSchema: Yup.object({
      name: Yup.string()
        .required('Name is required'),
      email: Yup.string()
        .email('Invalid email address')
        .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Must be a valid email format')
        .required('Email is required'),
      password: Yup.string()
        .min(8, 'Password must be at least 8 characters')
        .required('Password is required'),
      acceptTerms: Yup.boolean()
        .oneOf([true], 'You must accept the terms and conditions'),
    }),
    onSubmit: async (values) => {
      console.log('Submitting form with values:', values);
      try {
        await onSignUp(values.name, values.email, values.password);
      } catch (error) {
        console.error('Signup error:', error);
      }
    },
  });

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Create an account</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Join to share and discover music with others
        </p>
      </div>

      <OAuthButtons 
        onGoogleSignIn={onGoogleSignIn}
        onSpotifySignIn={onSpotifySignIn}
        isLoading={isLoading}
      />

      <form onSubmit={formik.handleSubmit} className="space-y-4">
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="name"
          label="Full Name"
          placeholder="John Doe"
          leftIcon={<FaUser className="h-5 w-5 text-gray-400" />}
          value={formik.values.name}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.name && formik.errors.name ? formik.errors.name : undefined}
          disabled={isLoading}
        />

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
          autoComplete="new-password"
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
          helperText="Must be at least 8 characters"
          disabled={isLoading}
        />

        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id="acceptTerms"
              name="acceptTerms"
              type="checkbox"
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              checked={formik.values.acceptTerms}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              disabled={isLoading}
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="acceptTerms" className="font-medium text-gray-700 dark:text-gray-300">
              I agree to the{' '}
              <a href="#" className="text-primary-600 hover:text-primary-500 dark:text-primary-400">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="text-primary-600 hover:text-primary-500 dark:text-primary-400">
                Privacy Policy
              </a>
            </label>
            {formik.touched.acceptTerms && formik.errors.acceptTerms ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {formik.errors.acceptTerms}
              </p>
            ) : null}
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          isLoading={isLoading}
        >
          Sign up
        </Button>
      </form>

      <div className="text-center mt-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onLoginClick}
            className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};

export default SignupForm; 