/*
 this file centralizes all constants used across the app for authentication
 Import from this file instead of defining constants in individual files
*/

import Constants from 'expo-constants';

const config = Constants.expoConfig;

// Authentication Constatns
export const COOKIE_NAME = "auth_token";
export const REFRESH_COOKIE_NAME = "refresh_token";
export const COOKIE_MAX_AGE = 20; // 20 seconds
export const JWT_EXPIRATION_TIME = "20s"; // 20 seconds
export const REFRESH_TOKEN_EXPIRY = "30d";
export const REFRESH_TOKEN_MAX_AGE = 30*24*3600; // 30 days in secs

// Refresh Token Constants
export const REFRESH_BEFORE_EXPIRY_SEC = 60;

// Google OAuth removed (OTP-only auth)

// Environment Constants
export const BASE_URL = config?.extra?.baseUrl || 'http://10.7.2.99:8081';
export const APP_SCHEME = 'lexi://';
export const JWT_SECRET = config?.extra?.jwtSecret || 'default_jwt_secret';

// Cookie Settings
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "Lax" as const,
  path: "/",
  maxAge: COOKIE_MAX_AGE,
};

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "Lax" as const,
  path: "/api/auth/refresh", // restrict to refresh endpoint only
  maxAge: REFRESH_TOKEN_MAX_AGE,
};
