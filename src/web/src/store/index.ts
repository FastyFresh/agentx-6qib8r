/**
 * Root Redux store configuration with enhanced middleware, performance monitoring,
 * and security features for the AGENT AI Platform
 * @version 1.0.0
 */

import { configureStore, combineReducers } from '@reduxjs/toolkit'; // ^1.9.5
import authReducer from './auth/authSlice';
import agentsReducer from './agents/agentSlice';
import integrationsReducer from './integrations/integrationSlice';
import metricsReducer from './metrics/metricsSlice';

// Combine all feature reducers with type safety
const rootReducer = combineReducers({
  auth: authReducer,
  agents: agentsReducer,
  integrations: integrationsReducer,
  metrics: metricsReducer
});

// Configure store with enhanced middleware and monitoring
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Enable runtime type checking in development
      serializableCheck: {
        // Ignore specific action types that may contain non-serializable data
        ignoredActions: [
          'auth/login/fulfilled',
          'auth/verifyMFA/fulfilled',
          'metrics/updateMetrics'
        ],
        // Ignore specific paths in state that may contain non-serializable data
        ignoredPaths: ['auth.user', 'metrics.systemHealth.lastUpdated']
      },
      // Enable immutability checks in development
      immutableCheck: true,
      // Thunk middleware configuration
      thunk: {
        extraArgument: undefined
      }
    }),
  devTools: process.env.NODE_ENV !== 'production' && {
    // Configure Redux DevTools with security considerations
    name: 'AGENT AI Platform',
    maxAge: 50, // Limit action history
    trace: true,
    traceLimit: 25,
    // Sanitize state and actions for sensitive data
    actionSanitizer: (action) => {
      if (action.type.startsWith('auth/')) {
        return {
          ...action,
          payload: action.payload ? '[REDACTED]' : undefined
        };
      }
      return action;
    },
    stateSanitizer: (state) => {
      if (state.auth) {
        return {
          ...state,
          auth: {
            ...state.auth,
            accessToken: '[REDACTED]',
            refreshToken: '[REDACTED]'
          }
        };
      }
      return state;
    }
  }
});

// Export store instance and types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Enable hot module replacement for reducers in development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./auth/authSlice', () => {
    store.replaceReducer(rootReducer);
  });
  module.hot.accept('./agents/agentSlice', () => {
    store.replaceReducer(rootReducer);
  });
  module.hot.accept('./integrations/integrationSlice', () => {
    store.replaceReducer(rootReducer);
  });
  module.hot.accept('./metrics/metricsSlice', () => {
    store.replaceReducer(rootReducer);
  });
}

// Export pre-typed hooks for use in components
export const useAppDispatch = () => store.dispatch as AppDispatch;
export const useAppSelector = <T>(selector: (state: RootState) => T): T => 
  selector(store.getState());

// Freeze store configuration to prevent runtime modifications
Object.freeze(store);