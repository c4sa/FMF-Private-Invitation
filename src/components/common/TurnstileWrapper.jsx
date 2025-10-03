import React, { useState, useEffect } from 'react';
import TurnstileVerification from './TurnstileVerification';
import App from '@/App';

const TurnstileWrapper = () => {
  const [isVerified, setIsVerified] = useState(false);
  const [verificationToken, setVerificationToken] = useState(null);

  // Check if user is already verified (persist verification for the session)
  useEffect(() => {
    const verified = sessionStorage.getItem('turnstile-verified');
    const token = sessionStorage.getItem('turnstile-token');
    
    if (verified === 'true' && token) {
      setIsVerified(true);
      setVerificationToken(token);
    }
  }, []);

  const handleVerificationSuccess = (token) => {
    // Store verification in session storage
    sessionStorage.setItem('turnstile-verified', 'true');
    sessionStorage.setItem('turnstile-token', token);
    setVerificationToken(token);
    setIsVerified(true);
  };

  const handleVerificationError = (error) => {
    console.error('Turnstile verification failed:', error);
    // Optionally show error message or retry
  };

  // If verified, show the main app
  if (isVerified) {
    return <App />;
  }

  // Otherwise, show Turnstile verification
  return (
    <TurnstileVerification
      onVerificationSuccess={handleVerificationSuccess}
      onVerificationError={handleVerificationError}
    />
  );
};

export default TurnstileWrapper;
