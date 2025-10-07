import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Lock, Eye, EyeOff, Mail, Shield, AlertCircle } from 'lucide-react';
import { sendOTP, verifyOTP, updateIsReset } from '@/api/functions';
import { User } from '@/api/entities';
import { supabase } from '@/lib/supabase';
import { useToast } from '../components/common/Toast';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState('email'); // 'email', 'otp', 'password', 'success'
  const { toast } = useToast();

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(''); // Clear error when user types
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // First check if the email exists in the users table
      const users = await User.filter({ email: formData.email });
      
      if (users.length === 0) {
        toast({
          title: "Email Not Found",
          description: "This email address is not registered in our system.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // If email exists, send the OTP
      await sendOTP(formData.email, 'password_reset', null, 'User');
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await verifyOTP(formData.email, formData.otp, 'password_reset');
      
      if (result.success) {
        setStep('password');
      }
    } catch (err) {
      setError(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    // Validate password length
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setIsLoading(false);
      return;
    }

    try {
      // Since we've already verified the OTP, we can directly update the password
      // We'll use our server-side API endpoint to update the password
      
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');
      
      const response = await fetch(`${API_BASE_URL}/api/update-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      });

      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = 'Failed to update password. Please try again.';
        try {
          const result = await response.json();
          errorMessage = result.error || errorMessage;
        } catch (jsonError) {
          // If we can't parse JSON, use the status text
          errorMessage = response.statusText || errorMessage;
        }
        setError(errorMessage);
        return;
      }

      const result = await response.json();
      
      // Now update the is_reset field
      try {
        await updateIsReset(formData.email);
      } catch (resetError) {
        // Don't fail the password reset if is_reset update fails
        console.warn('Password reset successful but failed to update is_reset status:', resetError);
      }

      setStep('success');
      
    } catch (err) {
      if (err.message.includes('Failed to fetch') || err.message.includes('404')) {
        setError('API endpoint not available. Please check your connection and try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
      console.error('Password reset error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ email: '', otp: '', password: '', confirmPassword: '' });
    setError('');
    setStep('email');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card className="bg-white shadow-lg rounded-lg">
          <CardContent className="p-8">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img 
                src="https://xpuhnbeoczxxmzmjronk.supabase.co/storage/v1/object/public/system-assets/logo.jpeg" 
                alt="Future Minerals Forum Logo" 
                className="w-16 h-16 object-contain"
              />
            </div>

            {/* Title and Subtitle */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {step === 'email' && 'Reset Password'}
                {step === 'otp' && 'Verify Email'}
                {step === 'password' && 'Set New Password'}
                {step === 'success' && 'Password Reset'}
              </h1>
              <p className="text-sm text-gray-500">
                {step === 'email' && 'Enter your email to receive a verification code'}
                {step === 'otp' && 'Enter the verification code sent to your email'}
                {step === 'password' && 'Create a new password for your account'}
                {step === 'success' && 'Your password has been reset successfully'}
              </p>
            </div>
            {step === 'email' && (
              <form onSubmit={handleSendOTP} className="space-y-6">
                {error && (
                  <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded-md">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="pl-10 h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md"
                  disabled={isLoading}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  {isLoading ? 'Sending Code...' : 'Send Verification Code'}
                </Button>

                <div className="flex justify-center items-center text-sm">
                  <p className="text-gray-600">
                    Remember your password?{' '}
                    <Link to="/login" className="text-blue-600 hover:text-blue-500 font-medium">
                      Sign in
                    </Link>
                  </p>
                </div>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleVerifyOTP} className="space-y-6">
                {error && (
                  <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded-md">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-sm font-medium text-gray-700">Verification Code</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={formData.otp}
                    onChange={(e) => handleInputChange('otp', e.target.value)}
                    maxLength={6}
                    className="text-center text-lg tracking-widest h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                  <p className="text-sm text-gray-500">
                    We sent a verification code to {formData.email}
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md"
                  disabled={isLoading || formData.otp.length !== 6}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  {isLoading ? 'Verifying...' : 'Verify Code'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12"
                  onClick={resetForm}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Email
                </Button>
              </form>
            )}

            {step === 'password' && (
              <form onSubmit={handleResetPassword} className="space-y-6">
                {error && (
                  <div className="flex items-center space-x-2 text-red-600 text-sm bg-red-50 p-3 rounded-md">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter new password"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className="pl-10 pr-10 h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm new password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      className="pl-10 pr-10 h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md"
                  disabled={isLoading}
                >
                  {isLoading ? 'Resetting Password...' : 'Reset Password'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12"
                  onClick={resetForm}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Start Over
                </Button>
              </form>
            )}

            {step === 'success' && (
              <div className="space-y-6 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Shield className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Password Reset Successfully!</h3>
                  <p className="text-sm text-gray-600 mt-2">
                    Your password has been reset. You can now sign in with your new password.
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md"
                >
                  Go to Sign In
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}