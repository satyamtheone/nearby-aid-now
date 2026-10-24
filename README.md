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

# Nearby request push notifications (Android)

Push notifications are sent by the authenticated `notify-nearby-request` Supabase Edge Function. It only targets Android registrations belonging to users whose most recently saved profile location is within 10 km of the new request. The request creator is excluded. A notification tap opens that request's chat in the app.

## Firebase and Supabase setup

1. In Firebase, register an Android app with package ID `com.nearbyaidnow.app`, enable Firebase Cloud Messaging, and download `google-services.json` into `android/app/google-services.json`. This client configuration is ignored by Git.
2. Create a Firebase service account authorized to send Firebase Cloud Messaging messages. Put its complete JSON contents in the ignored `supabase/functions/.env` file as `FIREBASE_SERVICE_ACCOUNT_JSON=...`; never put its private key in a `VITE_*` variable or in source control. For production, the CLI uploads this file to Supabase's secret store.
3. Apply the database migration with `supabase db push` (or apply `supabase/migrations/20261024040000_fcm_nearby_request_notifications.sql` in the Supabase SQL editor).
4. Set the service account secret in the Supabase project and deploy the function:

   ```sh
   supabase secrets set --env-file supabase/functions/.env
   supabase functions deploy notify-nearby-request
   ```

5. Install the Capacitor push-notifications plugin, sync Android, and rebuild the app:

   ```sh
   npm install @capacitor/push-notifications@^7.0.7
   npm run cap:sync
   ```

   On first Android launch, allow notification permission. Android 13 and newer require this runtime permission.

For local Edge Function development, put the service account JSON in an ignored `supabase/functions/.env` file. A blank template is in `supabase/functions/.env.example`. The production secret belongs in Supabase's secret store, not in the app's `.env` or Android assets.
