import { useEffect, useRef, useState } from 'react';

const TurnstileVerification = ({ onSuccess, onError, sitekey }) => {
  const [isVerified, setIsVerified] = useState(false);
  const [token, setToken] = useState(null);
  const turnstileRef = useRef(null);

  useEffect(() => {
    // Wait for Turnstile to load
    const checkTurnstile = () => {
      if (window.turnstile) {
        renderTurnstile();
      } else {
        setTimeout(checkTurnstile, 100);
      }
    };

    checkTurnstile();

    return () => {
      if (turnstileRef.current && window.turnstile) {
        window.turnstile.remove(turnstileRef.current);
      }
    };
  }, []);

  const renderTurnstile = () => {
    if (turnstileRef.current && window.turnstile) {
      window.turnstile.remove(turnstileRef.current);
    }

    const widgetId = window.turnstile.render('#turnstile-container', {
      sitekey: sitekey,
      callback: (token) => {
        setToken(token);
        setIsVerified(true);
        onSuccess && onSuccess(token);
      },
      'error-callback': (error) => {
        setIsVerified(false);
        setToken(null);
        onError && onError(error);
      },
      'expired-callback': () => {
        setIsVerified(false);
        setToken(null);
      },
      'timeout-callback': () => {
        setIsVerified(false);
        setToken(null);
      }
    });

    turnstileRef.current = widgetId;
  };

  const resetTurnstile = () => {
    if (turnstileRef.current && window.turnstile) {
      window.turnstile.reset(turnstileRef.current);
      setIsVerified(false);
      setToken(null);
    }
  };

  return (
    <div className="turnstile-verification">
      <div id="turnstile-container"></div>
      {isVerified && (
        <div className="text-green-600 text-sm mt-2">
          ✓ Verification completed
        </div>
      )}
    </div>
  );
};

export default TurnstileVerification;
