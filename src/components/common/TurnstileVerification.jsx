import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAB4vjecSFNelVUVy';

const TurnstileVerification = ({ onVerificationSuccess, onVerificationError }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState(null);
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    const initializeTurnstile = () => {
      if (window.turnstile) {
        try {
          widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            callback: async (token) => {
              setIsVerifying(true);
              try {
                // Verify token with server
                const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');
                
                const response = await fetch(`${API_BASE_URL}/api/verify-turnstile`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ token })
                });

                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.error || 'Verification failed');
                }

                const result = await response.json();
                if (result.success) {
                  onVerificationSuccess(token);
                } else {
                  throw new Error('Verification failed');
                }
              } catch (error) {
                console.error('Token verification failed:', error);
                setError('Verification failed. Please try again.');
                onVerificationError(error);
              } finally {
                setIsVerifying(false);
              }
            },
            'error-callback': (error) => {
              console.error('Turnstile error:', error);
              setError('Verification failed. Please try again.');
              onVerificationError(error);
            },
            'expired-callback': () => {
              console.log('Turnstile expired');
              setError('Verification expired. Please try again.');
            },
            'timeout-callback': () => {
              console.log('Turnstile timeout');
              setError('Verification timed out. Please try again.');
            }
          });
          setIsLoading(false);
        } catch (err) {
          console.error('Failed to initialize Turnstile:', err);
          setError('Failed to load verification. Please refresh the page.');
          setIsLoading(false);
        }
      } else {
        // Retry after a short delay if Turnstile script hasn't loaded yet
        setTimeout(initializeTurnstile, 100);
      }
    };

    initializeTurnstile();

    // Cleanup function
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (err) {
          console.error('Failed to remove Turnstile widget:', err);
        }
      }
    };
  }, [onVerificationSuccess, onVerificationError]);

  const handleRetry = () => {
    setError(null);
    setIsVerifying(false);
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch (err) {
        console.error('Failed to reset Turnstile:', err);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">
            Security Verification
          </CardTitle>
          <CardDescription>
            Please complete the security verification to access the Future Minerals Forum system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="mt-4 text-sm text-gray-600">Loading verification...</p>
            </div>
          ) : (
            <>
              <div className="flex justify-center">
                <div ref={turnstileRef} />
              </div>
              
              {isVerifying && (
                <div className="flex flex-col items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <p className="mt-2 text-sm text-gray-600">Verifying...</p>
                </div>
              )}
              
              {error && (
                <div className="text-center">
                  <p className="text-sm text-red-600 mb-4">{error}</p>
                  <Button onClick={handleRetry} variant="outline" size="sm">
                    Try Again
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TurnstileVerification;
