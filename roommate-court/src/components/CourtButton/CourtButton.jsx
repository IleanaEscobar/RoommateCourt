import React from 'react';
import './CourtButton.css';

const CourtButton = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  fullWidth = false,
  disabled = false,
  className = '',
}) => {
    
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`court-btn ${variant} ${fullWidth ? 'full-width' : ''} ${className}`.trim()}
    >
      {children}
    </button>
  );
};

export default CourtButton;