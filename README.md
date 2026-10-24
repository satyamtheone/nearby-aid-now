# Nearby Aid Now

Nearby Aid Now is a React, TypeScript, and Vite community help app backed by Supabase. It runs in the browser and has a Capacitor Android project in `android/`.

## Requirements

- Node.js 20 or newer
- Android Studio with an Android SDK to build or run the Android app
- Java 21 for Gradle (use Android Studio's bundled JBR 21)

## Run the web app

```sh
npm ci
npm run dev
```

Create a production web build with `npm run build`.

## Build the Android app

After installing Android Studio and its Android SDK:

```sh
npm ci
npm run cap:sync
npm run android
```

`cap:sync` builds the web app and copies it and the Capacitor plugins into the Android project. Android Studio can then sync Gradle and run the app on an emulator or device. The application ID is `com.nearbyaidnow.app`.

Email verification in the Android app returns through `com.nearbyaidnow.app://auth`. Add that URL to **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs** before testing Android sign-up. The app asks for location permission when it first requests the device location.

## Checks

```sh
npm run build
npx tsc -p tsconfig.app.json --noEmit
npm run lint
```

# Nearby request push notifications

Push notifications are sent by the authenticated `notify-nearby-request` Supabase Edge Function. It targets registered Android and opted-in browser devices belonging to users whose most recently saved profile location is within 10 km of the new request. The request creator is excluded. Android notification taps and web notification clicks open that request's chat.

## Firebase and Supabase setup

1. In Firebase, register an Android app with package ID `com.nearbyaidnow.app`, enable Firebase Cloud Messaging, and download `google-services.json` into `android/app/google-services.json`. This client configuration is ignored by Git.
2. For web push, register a **Web app** in the same Firebase project. Copy its Firebase config and the Web Push VAPID public key into the `VITE_FIREBASE_*` entries in a local `.env.local` file (see `.env.example`). These client config values are public; never place a service-account private key in a `VITE_*` variable.
3. Create a Firebase service account authorized to send Firebase Cloud Messaging messages. Put its full service-account JSON in the ignored `supabase/functions/.env` file as `FIREBASE_SERVICE_ACCOUNT_JSON=...`. This must be the service-account file with `client_email` and `private_key`, not `google-services.json`. Optionally set `WEB_APP_ORIGIN=https://your-site.example` so browser notification clicks open the request chat.
4. Apply the database migrations in order, including `20261024040000_fcm_nearby_request_notifications.sql`, `20261024050000_restore_help_request_insert_policy.sql`, `20261024060000_secure_help_request_creation_rpc.sql`, and `20261024070000_web_push_tokens.sql` (or run `supabase db push` after linking and logging in to the Supabase CLI).
5. Set the server secrets in Supabase and deploy the function:

   ```sh
   supabase secrets set --env-file supabase/functions/.env
   supabase functions deploy notify-nearby-request
   ```

6. Sync Android and rebuild the app:

   ```sh
   npm run cap:sync
   ```

   On first Android launch, allow notification permission. Android 13 and newer require this runtime permission. Browser users sign in, open **Edit Profile**, and select **Enable browser notifications**. Browsers require HTTPS (localhost is suitable for local development).

For local Edge Function development, put the service account JSON in an ignored `supabase/functions/.env` file. A blank template is in `supabase/functions/.env.example`. The production secret belongs in Supabase's secret store, not in the app's `.env` or Android assets.
