import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';

// Resolve server URL from app config (EAS Update friendly) with smart fallbacks
let RESOLVED_SERVER_URL: string | null = null;
let resolvingPromise: Promise<string> | null = null;

const getConfiguredServerUrl = (): string | null => {
  const url = ((Constants?.expoConfig as any)?.extra?.serverUrl) as string | undefined;
  return url || null;
};

const getEnvServerUrl = (): string | null => {
  try {
    const url = (process.env as any)?.EXPO_PUBLIC_SERVER_URL as string | undefined;
    return url || null;
  } catch {
    return null;
  }
};

const getDebugHost = (): string | null => {
  // Try various expo fields to extract the Metro host IP
  const expoConfig: any = (Constants as any)?.expoConfig || {};
  const hostUri: string | undefined = expoConfig?.hostUri || expoConfig?.developer?.hostUri;
  if (hostUri && hostUri.includes(':')) {
    const host = hostUri.split(':')[0];
    return host || null;
  }
  const manifest: any = (Constants as any)?.manifest || (Constants as any)?.manifest2 || {};
  const debuggerHost: string | undefined = manifest?.debuggerHost;
  if (debuggerHost && debuggerHost.includes(':')) {
    const host = debuggerHost.split(':')[0];
    return host || null;
  }
  return null;
};

const candidateBaseUrls = (): string[] => {
  const candidates: string[] = [];
  const envUrl = getEnvServerUrl();
  if (envUrl) candidates.push(envUrl);
  const configured = getConfiguredServerUrl();
  if (configured) candidates.push(configured);
  const debugHost = getDebugHost();
  if (debugHost) candidates.push(`http://${debugHost}:5000`);
  // iOS Simulator can reach host via localhost
  if (Platform.OS === 'ios') candidates.push('http://localhost:5000');
  // Android emulator special loopback
  if (Platform.OS === 'android') candidates.push('http://10.0.2.2:5000');
  // Generic local fallback
  candidates.push('http://127.0.0.1:5000');
  return Array.from(new Set(candidates));
};

const tryReachable = async (base: string): Promise<boolean> => {
  try {
    const response = await Promise.race([
      fetch(`${base}/test`),
      createTimeoutPromise(3000)
    ]) as Response;
    return !!response && response.ok;
  } catch {
    return false;
  }
};

const resolveServerUrl = async (): Promise<string> => {
  if (RESOLVED_SERVER_URL) return RESOLVED_SERVER_URL;
  if (resolvingPromise) return resolvingPromise;
  resolvingPromise = (async () => {
    const candidates = candidateBaseUrls();
    for (const base of candidates) {
      const ok = await tryReachable(base);
      if (ok) {
        RESOLVED_SERVER_URL = base;
        try { console.log('[DEBUG] Resolved server URL:', base); } catch {}
        return base;
      }
    }
    // Fallback to first candidate even if not reachable (caller will surface error)
    const fallback = candidates[0] || 'http://127.0.0.1:5000';
    RESOLVED_SERVER_URL = fallback;
    try { console.log('[DEBUG] Using fallback server URL:', fallback); } catch {}
    return fallback;
  })();
  return resolvingPromise;
};

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
  const base = await resolveServerUrl();
  const url = `${base}${endpoint}`;
  const cacheKey = `${options.method || 'GET'}_${url}_${JSON.stringify(options.body || '')}`;

  // Check cache for GET requests
  if (!options.method || options.method === 'GET') {
    const cached = getCachedResponse(cacheKey);
    if (cached) return cached;
  }

  try {
    // Create fetch promise
    try { console.log('[DEBUG] Fetching:', url); } catch {}
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
    // Avoid red error overlays; let callers handle gracefully
    try { console.error('[DEBUG] Request failed:', url, error); } catch {}
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

  // Lexi simplified API
  getLexiUserByEmail: async (email: string) => {
    try {
      const user = await makeRequest(`/lexi/users/${encodeURIComponent(email)}`);
      return user && Object.keys(user).length > 0 ? user : null;
    } catch (e) {
      return null;
    }
  },

  setUserConsent: async (email: string, consent: boolean) => {
    try {
      const result = await makeRequest(`/lexi/users/${encodeURIComponent(email)}/consent`, {
        method: 'POST',
        body: JSON.stringify({ consent }),
      });
      return result as { success: boolean };
    } catch (e) {
      return { success: false };
    }
  },

  upsertLexiUser: async (params: { name: string; email: string; anchor_answer?: string[] }) => {
    try {
      const result = await makeRequest('/lexi/users', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return result;
    } catch (e) {
      return { success: false };
    }
  },

  createLexiResponse: async (payload: {
    user_id: string;
    general_area: string;
    specific_location: string;
    language_spoken: string;
    num_speakers: number;
    was_part_of_conversation: boolean;
    followup_details?: string;
    comfortable_to_ask_more?: 'Yes' | 'No' | "I don't know";
    go_up_to_speakers?: 'Yes' | 'No' | "I don't know";
    // Optional extended fields
    speaker_said_audio_url?: string;
    speaker_origin?: string;
    speaker_cultural_background?: string;
    speaker_dialect?: string;
    speaker_context?: string;
    speaker_proficiency?: string;
    speaker_gender_identity?: 'Female' | 'Male' | 'Transgender' | 'Non-binary / Gender nonconforming' | 'Prefer not to say' | 'Other';
    speaker_gender_other_text?: string;
    speaker_academic_level?: 'Freshman' | 'Sophomore' | 'Junior' | 'Senior' | 'Davis Scholar' | 'Faculty/Staff' | 'Pre-college' | 'Non Wellesley-affiliated adult';
    additional_comments?: string;
    outstanding_questions?: string;
    determination_methods: string[];
    determination_other_text?: string;
    latitude?: number;
    longitude?: number;
  }) => {
    try {
      const result = await makeRequest('/lexi/responses', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return result;
    } catch (e) {
      return { success: false };
    }
  },

  listLexiResponses: async () => {
    try {
      const result = await makeRequest('/lexi/responses');
      return result as { responses: any[] };
    } catch (e) {
      return { responses: [] };
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

  // Request OTP code
  requestOtpCode: async (email: string) => {
    try {
      const result = await makeRequest('/auth/request-code', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      return result;
    } catch (error) {
      // Swallow to avoid redbox; callers can show a friendly message
      return { success: false, error: 'Failed to request code' };
    }
  },

  // Verify OTP code
  verifyOtpCode: async (email: string, code: string) => {
    try {
      const result = await makeRequest('/auth/verify-code', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      return result;
    } catch (error) {
      console.error('Error verifying OTP code:', error);
      return { success: false, error: 'Failed to verify code' };
    }
  },

  // Create first-time user profile
  createUserProfile: async (email: string, name: string, options?: { consent?: boolean; anchor_answer?: string[] }) => {
    try {
      const result = await makeRequest('/users', {
        method: 'POST',
        body: JSON.stringify({ email, name, consent: options?.consent ?? false, anchor_answer: options?.anchor_answer }),
      });
      return result;
    } catch (error) {
      return { success: false, error: 'Failed to save profile' };
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
