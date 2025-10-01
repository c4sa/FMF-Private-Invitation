/**
 * Utility functions for handling common database errors
 */

/**
 * Check if an error is a duplicate email constraint violation
 * @param {Error} error - The error object
 * @returns {boolean} - True if it's a duplicate email error
 */
export const isDuplicateEmailError = (error) => {
  if (!error) return false;
  
  const errorMessage = error.message || '';
  const errorCode = error.code || '';
  
  // Check for PostgreSQL unique constraint violation
  if (errorCode === '23505' && errorMessage.includes('email')) {
    return true;
  }
  
  // Check for common duplicate email error messages
  if (errorMessage.includes('duplicate key value violates unique constraint') && 
      errorMessage.includes('email')) {
    return true;
  }
  
  if (errorMessage.includes('already exists') && 
      errorMessage.includes('email')) {
    return true;
  }
  
  if (errorMessage.includes('is not unique') && 
      errorMessage.includes('email')) {
    return true;
  }
  
  return false;
};

/**
 * Get a user-friendly error message for duplicate email errors
 * @param {Error} error - The error object
 * @param {string} context - The context (e.g., 'attendee', 'user')
 * @returns {string} - User-friendly error message
 */
export const getDuplicateEmailErrorMessage = (error, context = 'attendee') => {
  const contextCapitalized = context.charAt(0).toUpperCase() + context.slice(1);
  return `${contextCapitalized} with this email already exists.`;
};

/**
 * Handle duplicate email errors with consistent messaging
 * @param {Error} error - The error object
 * @param {Object} setters - Object containing setter functions
 * @param {Function} setters.setSubmissionError - Function to set submission error
 * @param {Function} setters.setFieldError - Function to set field error
 * @param {Function} setters.setEmailError - Function to set email error (optional)
 * @param {string} context - The context (e.g., 'attendee', 'user')
 * @returns {boolean} - True if it was a duplicate email error
 */
export const handleDuplicateEmailError = (error, setters, context = 'attendee') => {
  if (isDuplicateEmailError(error)) {
    const errorMessage = getDuplicateEmailErrorMessage(error, context);
    
    // Set various error states
    if (setters.setSubmissionError) {
      setters.setSubmissionError(errorMessage);
    }
    
    if (setters.setFieldError) {
      setters.setFieldError('email', errorMessage);
    }
    
    if (setters.setEmailError) {
      setters.setEmailError(errorMessage);
    }
    
    return true;
  }
  
  return false;
};

/**
 * Get a generic error message for unexpected errors
 * @param {Error} error - The error object
 * @param {string} operation - The operation being performed (e.g., 'registration', 'update')
 * @returns {string} - Generic error message
 */
export const getGenericErrorMessage = (error, operation = 'operation') => {
  const operationCapitalized = operation.charAt(0).toUpperCase() + operation.slice(1);
  return `An unexpected error occurred during ${operation}. Please try again.`;
};
