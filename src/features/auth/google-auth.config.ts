/**
 * Google OAuth Client IDs
 *
 * HOW TO GET THESE:
 * 1. Go to Supabase Dashboard → Authentication → Providers → Google → Enable it
 * 2. Set up OAuth in Google Cloud Console → Credentials
 * 3. Copy the Web client ID → paste into GOOGLE_WEB_CLIENT_ID
 * 4. For iOS: find the iOS OAuth client in Google Cloud Console → copy ID
 * 5. For Android: same but find the Android OAuth client
 *
 * For local development with Expo Go, only GOOGLE_WEB_CLIENT_ID is required.
 */

export const GOOGLE_WEB_CLIENT_ID =
  "1053969645594-REPLACE_WITH_YOUR_WEB_CLIENT_ID.apps.googleusercontent.com";

export const GOOGLE_IOS_CLIENT_ID =
  "1053969645594-REPLACE_WITH_YOUR_IOS_CLIENT_ID.apps.googleusercontent.com";

export const GOOGLE_ANDROID_CLIENT_ID =
  "1053969645594-REPLACE_WITH_YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com";
