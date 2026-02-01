/**
 * Development-only validation banner.
 * 
 * Shows a visible banner when API responses contain validation errors.
 * This component is tree-shaken out of production builds.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ValidationErrorEvent {
  detail: {
    errors: string[];
  };
}

export function ValidationBanner() {
  const [errors, setErrors] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show banner in development
    if (import.meta.env.PROD) {
      return;
    }

    const handleValidationError = (event: Event) => {
      const customEvent = event as CustomEvent<ValidationErrorEvent['detail']>;
      setErrors(customEvent.detail.errors);
      setIsVisible(true);
    };

    window.addEventListener('api-validation-error', handleValidationError as EventListener);

    return () => {
      window.removeEventListener('api-validation-error', handleValidationError as EventListener);
    };
  }, []);

  // Don't render in production
  if (import.meta.env.PROD) {
    return null;
  }

  return (
    <AnimatePresence>
      {isVisible && errors.length > 0 && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white shadow-lg"
        >
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold mb-1">
                  API Response Validation Error (Dev Only)
                </div>
                <div className="text-sm space-y-1">
                  {errors.map((error, index) => (
                    <div key={index} className="font-mono text-xs bg-red-700/50 px-2 py-1 rounded">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setIsVisible(false)}
                className="flex-shrink-0 p-1 hover:bg-red-700 rounded transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

