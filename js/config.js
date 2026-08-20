// Fill these in following SETUP.md before deploying.
export const CONFIG = {
  // Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID
  // (type "Web application"). See SETUP.md §1.
  GOOGLE_CLIENT_ID: "811686460443-86r94592ibfv48bs709jpopf0jo242kf.apps.googleusercontent.com",

  // Backend for real background push notifications (server/ folder,
  // deployed to Cloud Run). PUSH_BACKEND_URL gets filled in once the first
  // deploy gives us the actual service URL — see server/README.md.
  PUSH_BACKEND_URL: "",
  VAPID_PUBLIC_KEY: "BD7UJu-wBpnChtgnm8VyGTjXAzzhSIrEdkbthWDjwz7Japj8jE2AqSVpopGP_lUvN0Jt0vcvVA7q5vwGtNgebWg",
};
