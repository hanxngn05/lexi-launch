import { Alert } from 'react-native';
import Constants from 'expo-constants';

// Resolve server URL from app config (EAS Update friendly); fallback to local dev
const SERVER_URL = ((Constants?.expoConfig as any)?.extra?.serverUrl) || 'http://10.155.6.92:5000';

// Add request caching for better performance
const cache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

const getCachedResponse = (key: string) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
};

const setCachedResponse = (key: string, data: any) => {
  cache.set(key, { data, timestamp: Date.now() });
};

// Create a timeout promise for React Native compatibility
const createTimeoutPromise = (timeoutMs: number) => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
  });
};

export const makeRequest = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${SERVER_URL}${endpoint}`;
  const cacheKey = `${options.method || 'GET'}_${url}_${JSON.stringify(options.body || '')}`;

  // Check cache for GET requests
  if (!options.method || options.method === 'GET') {
    const cached = getCachedResponse(cacheKey);
    if (cached) return cached;
  }

  try {
    // Create fetch promise
    const fetchPromise = fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Race between fetch and timeout
    const response = await Promise.race([
      fetchPromise,
      createTimeoutPromise(10000) // 10 second timeout
    ]) as Response;

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Cache successful GET responses
    if (!options.method || options.method === 'GET') {
      setCachedResponse(cacheKey, data);
    }

    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

export const api = {
  getUserByEmail: async (email: string) => {
    if (!email) return null;
    try {
      console.log('[DEBUG] API: Getting user by email:', email);
      const user = await makeRequest(`/users/${encodeURIComponent(email)}`);
      console.log('[DEBUG] API: User data received:', user);
      return user && Object.keys(user).length > 0 ? user : null;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  },

  getUserById: async (userId: string) => {
    if (!userId) return null;
    try {
      console.log('[DEBUG] API: Getting user by ID:', userId);
      const user = await makeRequest(`/users/id/${encodeURIComponent(userId)}`);
      console.log('[DEBUG] API: User data received:', user);
      return user && Object.keys(user).length > 0 ? user : null;
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      return null;
    }
  },

  saveUser: async (userData: { email: string; name: string; role: 'user' | 'developer' }) => {
    try {
      console.log('[DEBUG] API: Saving user:', userData);
      const result = await makeRequest('/users', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      console.log('[DEBUG] API: Save user result:', result);
      return { success: result.success, user: result.user };
    } catch (error) {
      console.error('Failed to save user:', error);
      return { success: false };
    }
  },

  getWorkspaces: async () => {
    try {
      const result = await makeRequest('/workspaces');
      return result;
    } catch (error) {
      console.error('Error reading workspaces:', error);
      return { workspaces: [] };
    }
  },

  createWorkspace: async (workspaceData: Omit<any, 'id'>) => {
    try {
      const newWorkspace = {
        ...workspaceData,
        id: Math.random().toString(36).substring(2, 15),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      console.log('[DEBUG] API: Creating workspace with data:', newWorkspace);

      const result = await makeRequest('/workspaces', {
        method: 'POST',
        body: JSON.stringify(newWorkspace),
      });

      console.log('[DEBUG] API: Workspace creation result:', result);

      return { success: result.success, data: newWorkspace };
    } catch (error) {
      console.error('[DEBUG] API: Failed to create workspace:', error);
      return { success: false };
    }
  },

  getResponsesForWorkspace: async (id: string) => {
    try {
      const result = await makeRequest(`/responses/${id}`);
      return result;
    } catch (error) {
      console.error('Error fetching responses:', error);
      return { responses: [] };
    }
  },

  saveResponsesForWorkspace: async (id: string, data: { responses: any[] }) => {
    try {
      // Send the latest response to the server (the last one in the array)
      const latestResponse = data.responses[data.responses.length - 1];
      const result = await makeRequest(`/responses/${id}`, {
        method: 'POST',
        body: JSON.stringify(latestResponse),
      });

      if (result.success) {
        console.log(`Response saved to server for workspace: ${id}`);
      } else {
        throw new Error('Server returned failure');
      }
    } catch (error) {
      console.error(`Failed to save response for workspace ${id}:`, error);
      Alert.alert('Save Failed', 'Could not save pin data to server.');
    }
  },

  // Additional helper methods for server communication
  testServerConnection: async () => {
    try {
      const result = await makeRequest('/test');
      return result;
    } catch (error) {
      console.error('Server connection test failed:', error);
      return null;
    }
  },

  // Method to migrate existing data from local files to server
  migrateLocalData: async () => {
    // This would be used to migrate existing JSON data to the server
    // Implementation depends on your migration strategy
    console.log('Migration functionality would be implemented here');
  },

  // Check for typos using Gemini API
  checkTypo: async (text: string) => {
    try {
      const result = await makeRequest('/check-typo', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      return result;
    } catch (error) {
      console.error('Typo check failed:', error);
      return { suggestions: [], has_typos: false };
    }
  },

  // Get anchor question for a workspace
  getWorkspaceAnchorQuestion: async (workspaceId: string) => {
    try {
      console.log('[DEBUG] API: Getting anchor question for workspace:', workspaceId);
      const result = await makeRequest(`/workspaces/${workspaceId}/anchor-question`);
      console.log('[DEBUG] API: Anchor question result:', result);
      return result;
    } catch (error) {
      console.error('[DEBUG] API: Error fetching anchor question:', error);
      return { workspace_name: '', anchor_question: '' };
    }
  },

  // Join workspace with optional anchor answer
  joinWorkspace: async (userId: string, workspaceId: string, anchorAnswer?: string) => {
    try {
      const data: any = { workspace_id: workspaceId };
      if (anchorAnswer) {
        data.anchor_answer = anchorAnswer;
        console.log('[DEBUG] API: Sending anchor answer:', anchorAnswer);
      }

      console.log('[DEBUG] API: Joining workspace with data:', data);
      const result = await makeRequest(`/users/${userId}/join_workspace`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      console.log('[DEBUG] API: Join workspace result:', result);
      return result;
    } catch (error) {
      console.error('[DEBUG] API: Error joining workspace:', error);
      return { success: false, error: 'Failed to join workspace' };
    }
  },

  // Get user's anchor answers
  getUserAnchorAnswers: async (userId: string) => {
    try {
      const result = await makeRequest(`/users/${userId}/anchor-answers`);
      return result;
    } catch (error) {
      console.error('Error fetching anchor answers:', error);
      return { anchor_answers: {} };
    }
  },

  // Format answers using sentiment analysis
  formatAnswers: async (text: string, mainDataType?: string) => {
    try {
      console.log('[DEBUG] API: formatAnswers called with text:', text, 'mainDataType:', mainDataType);
      const result = await makeRequest('/format-answers-sentiment', {
        method: 'POST',
        body: JSON.stringify({ text, main_data_type: mainDataType || '' }),
      });
      console.log('[DEBUG] API: formatAnswers result:', result);
      return result;
    } catch (error) {
      console.error('Error formatting answers:', error);
      return { formatted_text: text };
    }
  },
};
