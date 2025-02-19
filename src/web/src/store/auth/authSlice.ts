import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'; // ^1.9.5
import { AuthState } from './types';
import { authService } from '../../services/authService';

// Initial state with comprehensive auth management
const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  error: null,
  accessToken: null,
  refreshToken: null,
  tokenExpiry: null,
  mfaRequired: false,
  mfaToken: null,
  rememberedDevices: []
};

// Enhanced async thunk for login with MFA support
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password, rememberMe = false }: { 
    email: string; 
    password: string; 
    rememberMe?: boolean 
  }, { rejectWithValue }) => {
    try {
      const response = await authService.login({ email, password, rememberMe });
      return response;
    } catch (error: any) {
      return rejectWithValue(error);
    }
  }
);

// Enhanced async thunk for MFA verification with device remember
export const verifyMFA = createAsyncThunk(
  'auth/verifyMFA',
  async ({ code, mfaToken, rememberDevice = false }: {
    code: string;
    mfaToken: string;
    rememberDevice?: boolean;
  }, { rejectWithValue }) => {
    try {
      const response = await authService.verifyMFA({ 
        code, 
        mfaToken,
        rememberDevice 
      });
      return response;
    } catch (error: any) {
      return rejectWithValue(error);
    }
  }
);

// Async thunk for token refresh
export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (token: string, { rejectWithValue }) => {
    try {
      const response = await authService.refreshToken(token);
      return response;
    } catch (error: any) {
      return rejectWithValue(error);
    }
  }
);

// Enhanced async thunk for secure logout
export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
    } catch (error: any) {
      return rejectWithValue(error);
    }
  }
);

// Enhanced Redux slice with comprehensive auth management
export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearMFAState: (state) => {
      state.mfaRequired = false;
      state.mfaToken = null;
    }
  },
  extraReducers: (builder) => {
    // Login action handlers
    builder.addCase(login.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(login.fulfilled, (state, action) => {
      state.isLoading = false;
      if (action.payload.mfaRequired) {
        state.mfaRequired = true;
        state.mfaToken = action.payload.mfaToken;
      } else {
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.tokenExpiry = action.payload.tokenExpiry;
      }
    });
    builder.addCase(login.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as any;
    });

    // MFA verification handlers
    builder.addCase(verifyMFA.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(verifyMFA.fulfilled, (state, action) => {
      state.isLoading = false;
      state.mfaRequired = false;
      state.mfaToken = null;
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.tokenExpiry = action.payload.tokenExpiry;
      if (action.payload.deviceId) {
        state.rememberedDevices = [...state.rememberedDevices, action.payload.deviceId];
      }
    });
    builder.addCase(verifyMFA.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as any;
    });

    // Token refresh handlers
    builder.addCase(refreshToken.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(refreshToken.fulfilled, (state, action) => {
      state.isLoading = false;
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.tokenExpiry = action.payload.tokenExpiry;
    });
    builder.addCase(refreshToken.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as any;
      // Force logout on refresh failure
      state.isAuthenticated = false;
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.tokenExpiry = null;
    });

    // Logout handlers
    builder.addCase(logout.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(logout.fulfilled, (state) => {
      return initialState;
    });
    builder.addCase(logout.rejected, (state, action) => {
      state.isLoading = false;
      state.error = action.payload as any;
      // Force logout even on error
      return initialState;
    });
  }
});

export const { clearError, clearMFAState } = authSlice.actions;
export default authSlice.reducer;