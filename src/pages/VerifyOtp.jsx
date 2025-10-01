import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Shield, Check, Mail, AlertCircle } from 'lucide-react';
import { verifyOTP } from '@/api/functions';
import { supabase } from '@/lib/supabase';

export default function VerifyOTP() {
  const navigate = useNavigate();
  const location = useLocation();
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');
  const [otpType, setOtpType] = useState('email_verification');

  useEffect(() => {
    // Get email and OTP type from location state
    const state = location.state;
    if (state?.email) {
      setEmail(state.email);
    }
    if (state?.otpType) {
      setOtpType(state.otpType);
    }
    
    // If no email provided, redirect to appropriate page
    if (!state?.email) {
      if (otpType === 'email_verification') {
        navigate('/signup');
      } else if (otpType === 'password_reset') {
        navigate('/reset-password');
      } else {
        navigate('/login');
      }
    }
  }, [location.state, navigate, otpType]);

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (otp.length !== 6) {
      setError('Please enter a 6-digit verification code');
      setIsLoading(false);
      return;
    }

    try {
      const result = await verifyOTP(email, otp, otpType);
      
      if (result.success) {
        setSuccess(true);
        
        // Redirect based on OTP type
        setTimeout(() => {
          if (otpType === 'email_verification') {
            navigate('/login', { state: { message: 'Email verified successfully. Please sign in.' } });
          } else if (otpType === 'password_reset') {
            navigate('/reset-password', { state: { email, verified: true } });
          } else {
            navigate('/Dashboard');
          }
        }, 2000);
      }
    } catch (err) {
      setError(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setIsLoading(true);
    setError('');

    try {
      // This would need to be implemented based on your OTP service
      setError('Resend functionality not implemented yet. Please request a new OTP from the previous page.');
    } catch (err) {
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    switch (otpType) {
      case 'email_verification':
        return 'Verify Your Email';
      case 'password_reset':
        return 'Verify Password Reset';
      case 'login_verification':
        return 'Verify Login';
      default:
        return 'Verify OTP';
    }
  };

  const getDescription = () => {
    switch (otpType) {
      case 'email_verification':
        return 'Enter the verification code sent to your email to complete your registration';
      case 'password_reset':
        return 'Enter the verification code sent to your email to reset your password';
      case 'login_verification':
        return 'Enter the verification code sent to your email to complete your login';
      default:
        return 'Enter the verification code sent to your email';
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">Future Minerals Forum</h1>
            <p className="mt-2 text-sm text-gray-600">Private Invitation System</p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Verification Successful!</h3>
                  <p className="text-sm text-gray-600 mt-2">
                    Your email has been verified successfully. Redirecting...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Future Minerals Forum</h1>
          <p className="mt-2 text-sm text-gray-600">Private Invitation System</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">{getTitle()}</CardTitle>
            <CardDescription className="text-center">
              {getDescription()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              {error && (
                <div className="flex items-center space-x-2 text-red-600 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  className="text-center text-lg tracking-widest"
                  required
                />
                <p className="text-sm text-gray-500">
                  We sent a verification code to {email}
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || otp.length !== 6}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  {isLoading ? 'Verifying...' : 'Verify Code'}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResendOTP}
                  disabled={isLoading}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Resend Code
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}