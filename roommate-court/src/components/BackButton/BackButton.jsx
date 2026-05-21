import React from 'react';
import { Link } from 'react-router-dom';
import './BackButton.css';

function BackButton({ to, children, className = '' }) {
  return (
    <Link
      to={to}
      className={`court-btn secondary back-button ${className}`.trim()}
    >
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}

export default BackButton;