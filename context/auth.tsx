import { AuthError, AuthRequestConfig, DiscoveryDocument, makeRedirectUri, useAuthRequest } from "expo-auth-session";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as React from "react";
import { api } from '../utils/api';

WebBrowser.maybeCompleteAuthSession();

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  email_verified?: boolean;
  provider?: string;
  exp?: number;
  cookieExpiration?: number;
  role?: 'user' | 'developer';
  workspaces?: string[];
};

type AuthContextType = {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
  isLoading: boolean;
  error: AuthError | null;
};

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  signIn: async () => {},
  signOut: async () => {},
  signInWithGoogle: async () => {},
  fetchWithAuth: async (url: string, options?: RequestInit) => Promise.resolve(new Response()),
  isLoading: false,
  error: null,
});

const config: AuthRequestConfig = {
  clientId: "1029128656486-sj55218ijb6k0lgi77mhgc995rlvctpq.apps.googleusercontent.com",
  scopes: ["openid", "profile", "email"],
  redirectUri: "com.hanxngn.lexi://",
  usePKCE: true,
};

console.log("Using redirect URI:", makeRedirectUri({
  scheme: 'com.hanxngn.lexi'
}));

const discovery: DiscoveryDocument = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
};

export const AuthProvider = ({ children }: {children: React.ReactNode }) => {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<AuthError | null>(null);
  const router = useRouter();

  const [request, response, promptAsync] = useAuthRequest(config, discovery);

  const checkUserExists = async (email: string) => {
    try {
      const userData = await api.getUserByEmail(email);
      return userData;
    } catch (error) {
      console.error('Error checking user:', error);
      return null;
    }
  };

  const saveUserToDatabase = async (userData: AuthUser) => {
    try {
      const result = await api.saveUser({
        email: userData.email,
        name: userData.name,
        role: userData.role || 'user'
      });
      return result.success;
    } catch (error) {
      console.error('Error saving user data:', error);
      return false;
    }
  };

  const getUserInfo = async (code: string) => {
    try {
      // Use manual PKCE code exchange
      if (!request) throw new Error('No auth request available');
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code: code,
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          grant_type: 'authorization_code',
          code_verifier: request.codeVerifier || '',
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token response error:', errorText);
        throw new Error('Failed to get tokens from Google');
      }

      const { access_token } = await tokenResponse.json();

      // Get user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        throw new Error('Failed to get user info from Google');
      }

      const googleUserData = await userInfoResponse.json();

      // Check if we have this user in our database
      const existingUser = await checkUserExists(googleUserData.email);

      if (existingUser) {
        // Return the user data from our database
        return {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          picture: googleUserData.picture,
          given_name: googleUserData.given_name,
          family_name: googleUserData.family_name,
          email_verified: googleUserData.verified_email,
          provider: 'google',
          role: existingUser.role,
          workspaces: existingUser.workspaces,
        };
      } else {
        // For new users, don't save to database yet - let onboarding handle it
        const newUserData = {
          id: 'google_' + googleUserData.id,
          email: googleUserData.email,
          name: googleUserData.name,
          picture: googleUserData.picture,
          given_name: googleUserData.given_name,
          family_name: googleUserData.family_name,
          email_verified: googleUserData.verified_email,
          provider: 'google',
          role: undefined, // Will be set during onboarding
        };

        // Don't save to database yet - onboarding will handle this
        return newUserData;
      }
    } catch (error) {
      console.error('Error getting user info:', error);
      throw error;
    }
  };

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      setIsLoading(true);

      getUserInfo(code)
        .then(userData => {
          setUser(userData);
          // Navigate directly to the Lexi workspace if available
          const goToLexi = async () => {
            try {
              const workspacesData: any = await api.getWorkspaces();
              const lexiWorkspace = (workspacesData?.workspaces || []).find((ws: any) =>
                typeof ws?.name === 'string' && ws.name.toLowerCase().includes('lexi')
              );
              if (lexiWorkspace?.id) {
                router.replace(`/workspace/${lexiWorkspace.id}`);
                return;
              }
            } catch (e) {
              console.error('Failed to locate Lexi workspace:', e);
            }
            // Fallback if Lexi workspace couldn't be found
            router.replace('/home');
          };
          setTimeout(goToLexi, 50);
        })
        .catch(error => {
          console.error('Auth error:', error);
          setError(error as AuthError);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (response?.type === 'error') {
      console.error('OAuth error:', response.error);
      setError(response.error as AuthError);
    }
  }, [response, router]);

  const signInWithGoogle = async () => {
    try {
      if (!request) {
        return;
      }
      await promptAsync();
    }
    catch (e) {
      console.log(e)
    }
  };

  const signIn = async (email: string, password: string) => {
    // Mock sign-in for now
    const mockUser = {
      id: '1',
      email,
      name: 'Test User',
    };

    setUser(mockUser);
    // After mock sign-in, route to Lexi workspace if available
    try {
      const workspacesData: any = await api.getWorkspaces();
      const lexiWorkspace = (workspacesData?.workspaces || []).find((ws: any) =>
        typeof ws?.name === 'string' && ws.name.toLowerCase().includes('lexi')
      );
      if (lexiWorkspace?.id) {
        router.replace(`/workspace/${lexiWorkspace.id}`);
        return;
      }
    } catch (e) {
      console.error('Failed to locate Lexi workspace after mock sign-in:', e);
    }
    router.replace('/home');
  };

  const signOut = async () => {
    setUser(null);
    router.replace('/');
  };

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    // Implement authenticated fetch
    return new Response();
  };

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      signIn,
      signOut,
      signInWithGoogle,
      fetchWithAuth,
      isLoading,
      error,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
