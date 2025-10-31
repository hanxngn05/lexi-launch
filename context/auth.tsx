import Constants from 'expo-constants';
import { useRouter } from "expo-router";
import * as React from "react";
import { api } from '../utils/api';

// No OAuth flows; OTP-only

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
  requestOtp: (email: string) => Promise<boolean>;
  verifyOtp: (email: string, code: string) => Promise<{ success: boolean; needsProfile?: boolean; email?: string }>;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
  isLoading: boolean;
  error: Error | null;
};

const AuthContext = React.createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  signIn: async () => {},
  signOut: async () => {},
  requestOtp: async () => false,
  verifyOtp: async () => ({ success: false }),
  fetchWithAuth: async (url: string, options?: RequestInit) => Promise.resolve(new Response()),
  isLoading: false,
  error: null,
});

const expoOwner = ((Constants?.expoConfig as any)?.owner) || 'anonymous';
const expoSlug = ((Constants?.expoConfig as any)?.slug) || 'lexi';
const appOwnership = (Constants as any)?.appOwnership as 'expo' | 'guest' | 'standalone' | undefined;
const appScheme = ((Constants?.expoConfig as any)?.scheme) || 'com.hanxngn.lexi';

export const AuthProvider = ({ children }: {children: React.ReactNode }) => {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const router = useRouter();

  // No OAuth warmups needed

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

  // OTP: request code
  const requestOtp = async (email: string) => {
    try {
      if (!email) return false;
      setIsLoading(true);
      const res = await api.requestOtpCode(email);
      return !!res?.success;
    } catch (e) {
      setError(e as Error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // OTP: verify code
  const verifyOtp = async (email: string, code: string) => {
    try {
      setIsLoading(true);
      const res: any = await api.verifyOtpCode(email, code);
      const needsProfile = Boolean(res?.needsProfile ?? res?.needs_profile);
      const verifiedEmail = (res?.email ?? res?.user?.email ?? email) as string;
      if (res?.success && needsProfile) {
        return { success: true, needsProfile: true, email: verifiedEmail };
      }
      if (res?.success && res?.user) {
        setUser(res.user);
        const serverConsent = Boolean((res.user as any)?.consent_given);
        const showConsent = !serverConsent;
        const consentMessage = 'You are being asked to take part in a research study for collecting information about languages used on campus. For the purposes of this project, a task involves answering a few short questions on a language that you heard around campus. Please read this consent form carefully, and ask any questions you may have before signing up for participation.\n\nQuestions should be directed to the project advisors, Yoolim Kim <ykim6@wellesley.edu>, Catherine Delcourt <cdelcour@wellesley.edu>, and Christine Bassem <cbassem@wellesley.edu>.\n\nWhat is this project about? The purpose of this study is to understand the use of different languages on campus, and strengthen communities with shared languages.\n\nWhat we will ask you to do? Once the study starts, you will be asked to submit information about languages that you recognize around campus.\n\nOnly actions directly related to the Lexi in Wellesley environment will be collected.\n\nTaking part is voluntary.\n\nHow do I provide my consent? Tap “I Agree”.';

        router.replace(showConsent ? '/consent' : '/workspace/lexi');
        return { success: true };
      }
      return { success: false };
    } catch (e) {
      setError(e as Error);
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const mockUser = {
      id: '1',
      email,
      name: 'Test User',
    };

    setUser(mockUser);
    router.replace('/home');
  };

  const signOut = async () => {
    setUser(null);
    router.replace('/');
  };

  const fetchWithAuth = async (url: string, options?: RequestInit) => {
    return new Response();
  };

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      signIn,
      signOut,
      requestOtp,
      verifyOtp,
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
