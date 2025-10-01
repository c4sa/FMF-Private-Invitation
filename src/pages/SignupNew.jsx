import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Mail, Lock, User, Building, Shield, AlertCircle } from 'lucide-react';
import { sendOTP, verifyOTP } from '@/api/functions';
import { supabase } from '@/lib/supabase';

export default function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    preferredName: '',
    companyName: '',
    otp: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState('form'); // 'form', 'otp', 'success'

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(''); // Clear error when user types
  };

  const handleSendOTP = async (e) => {
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

    // Validate required fields
    if (!formData.fullName || !formData.preferredName || !formData.companyName) {
      setError('Please fill in all required fields');
      setIsLoading(false);
      return;
    }

    try {
      await sendOTP(formData.email, 'email_verification', null, formData.preferredName);
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
      const result = await verifyOTP(formData.email, formData.otp, 'email_verification');
      
      if (result.success) {
        // OTP verified, now create the user account
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              preferred_name: formData.preferredName,
              company_name: formData.companyName
            }
          }
        });

        if (error) {
          setError(error.message);
          return;
        }

        if (data.user) {
          setStep('success');
        }
      }
    } catch (err) {
      setError(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ 
      email: '', 
      password: '', 
      confirmPassword: '', 
      fullName: '', 
      preferredName: '', 
      companyName: '', 
      otp: '' 
    });
    setError('');
    setStep('form');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Future Minerals Forum</h1>
          <p className="mt-2 text-sm text-gray-600">Private Invitation System</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {step === 'form' && 'Create Account'}
              {step === 'otp' && 'Verify Email'}
              {step === 'success' && 'Account Created'}
            </CardTitle>
            <CardDescription className="text-center">
              {step === 'form' && 'Fill in your details to get started'}
              {step === 'otp' && 'Enter the verification code sent to your email'}
              {step === 'success' && 'Your account has been created successfully'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'form' && (
              <form onSubmit={handleSendOTP} className="space-y-4">
                {error && (
                  <div className="flex items-center space-x-2 text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preferredName">Preferred Name *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="preferredName"
                      type="text"
                      placeholder="Enter your preferred name"
                      value={formData.preferredName}
                      onChange={(e) => handleInputChange('preferredName', e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="companyName"
                      type="text"
                      placeholder="Enter your company name"
                      value={formData.companyName}
                      onChange={(e) => handleInputChange('companyName', e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Create a password"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      className="pl-10"
                      required
                      minLength={8}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    {isLoading ? 'Sending Code...' : 'Send Verification Code'}
                  </Button>

                  <div className="text-center">
                    <p className="text-sm text-gray-600">
                      Already have an account?{' '}
                      <Link to="/login" className="text-blue-600 hover:text-blue-500">
                        Sign in
                      </Link>
                    </p>
                  </div>
                </div>
              </form>
            )}

            {step === 'otp' && (
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
                    value={formData.otp}
                    onChange={(e) => handleInputChange('otp', e.target.value)}
                    maxLength={6}
                    className="text-center text-lg tracking-widest"
                    required
                  />
                  <p className="text-sm text-gray-500">
                    We sent a verification code to {formData.email}
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading || formData.otp.length !== 6}
                  >
                    {isLoading ? 'Creating Account...' : 'Verify & Create Account'}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={resetForm}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Form
                  </Button>
                </div>
              </form>
            )}

            {step === 'success' && (
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Shield className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Account Created Successfully!</h3>
                  <p className="text-sm text-gray-600 mt-2">
                    Welcome to the Future Minerals Forum system. You can now sign in to your account.
                  </p>
                </div>
                <div className="space-y-3">
                  <Button
                    onClick={() => navigate('/login')}
                    className="w-full"
                  >
                    Go to Sign In
                  </Button>
                  <Button
                    onClick={resetForm}
                    variant="outline"
                    className="w-full"
                  >
                    Create Another Account
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
