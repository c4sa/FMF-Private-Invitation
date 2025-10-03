import { useState, useEffect } from 'react';
import TurnstileVerification from './TurnstileVerification';
import { verifyTurnstileToken } from '@/api/functions';

const TurnstileWrapper = ({ children }) => {
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get sitekey from environment variables
  const sitekey = import.meta.env.TURNSTILE_SITE_KEY;

  useEffect(() => {
    // Check if user is already verified (from session storage)
    const storedVerification = sessionStorage.getItem('turnstile-verified');
    if (storedVerification === 'true') {
      setIsVerified(true);
      setIsLoading(false);
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleTurnstileSuccess = async (token) => {
    try {
      // Verify the token with the server
      await verifyTurnstileToken(token);
      
      // Store verification in session storage
      sessionStorage.setItem('turnstile-verified', 'true');
      setIsVerified(true);
      setError(null);
    } catch (err) {
      console.error('Turnstile verification failed:', err);
      setError('Verification failed. Please try again.');
    }
  };

  const handleTurnstileError = (error) => {
    console.error('Turnstile error:', error);
    setError('Verification failed. Please try again.');
  };

  if (!sitekey) {
    console.warn('TURNSTILE_SITEKEY not configured');
    return children;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Security Verification
            </h1>
            <p className="text-gray-600">
              Please complete the security verification to continue.
            </p>
          </div>
          
          <TurnstileVerification
            sitekey={sitekey}
            onSuccess={handleTurnstileSuccess}
            onError={handleTurnstileError}
          />
          
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return children;
};

export default TurnstileWrapper;
