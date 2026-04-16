import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './presentation/App';
import './index.css';

// Load debug utilities in development
if (import.meta.env.DEV) {
  import('./data/storage/debugUtils');
}

console.log('=== TrustVault App Loading ===');

// Note: Service Worker is registered by vite-plugin-pwa automatically
// The generated registerSW.js handles registration and update detection

console.log('Looking for root element...');
const rootElement = document.getElementById('root');
console.log('Root element found:', !!rootElement);

if (!rootElement) {
  throw new Error('Failed to find the root element');
}

console.log('Creating React root and rendering App...');
try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('React app rendered successfully');
} catch (error) {
  console.error('Failed to render React app:', error);
  throw error;
}
