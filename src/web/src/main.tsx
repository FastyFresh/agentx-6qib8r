import React from 'react'; // ^18.2.0
import ReactDOM from 'react-dom/client'; // ^18.2.0
import { Provider } from 'react-redux'; // ^8.0.5
import { ThemeProvider } from '@mui/material'; // ^5.14.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.11

import App from './App';
import { store } from './store';
import { createAppTheme } from './config/theme.config';
import { notificationService } from './services/notificationService';

// Initialize performance monitoring
const initializePerformanceMonitoring = () => {
  if (process.env.NODE_ENV === 'development') {
    const reportWebVitals = (metric: any) => {
      console.log(metric);
    };

    // Report performance metrics in development
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(reportWebVitals);
      getFID(reportWebVitals);
      getFCP(reportWebVitals);
      getLCP(reportWebVitals);
      getTTFB(reportWebVitals);
    });
  }
};

// Error boundary fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div role="alert" style={{ padding: '20px', textAlign: 'center' }}>
    <h2>Application Error</h2>
    <pre style={{ color: 'red' }}>{error.message}</pre>
    <button
      onClick={resetErrorBoundary}
      style={{ padding: '8px 16px', marginTop: '16px' }}
    >
      Try again
    </button>
  </div>
);

// Error handler for error boundary
const handleError = (error: Error, info: { componentStack: string }) => {
  // Track error in notification service
  notificationService.trackError({
    error: {
      name: error.name,
      message: error.message,
      componentStack: info.componentStack
    }
  });

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Application Error:', error);
    console.error('Component Stack:', info.componentStack);
  }
};

// Initialize theme with system preferences
const theme = createAppTheme(
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  window.matchMedia('(prefers-color-scheme: dark)').matches,
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

// Root element for React application
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Create root and render application
const root = ReactDOM.createRoot(rootElement);

// Render application with providers and error boundary
root.render(
  <React.StrictMode>
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={() => {
        // Reset application state on error recovery
        window.location.href = '/';
      }}
    >
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <App />
        </ThemeProvider>
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Initialize performance monitoring
initializePerformanceMonitoring();

// Enable hot module replacement in development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./App', () => {
    root.render(
      <React.StrictMode>
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onError={handleError}
          onReset={() => {
            window.location.href = '/';
          }}
        >
          <Provider store={store}>
            <ThemeProvider theme={theme}>
              <App />
            </ThemeProvider>
          </Provider>
        </ErrorBoundary>
      </React.StrictMode>
    );
  });
}