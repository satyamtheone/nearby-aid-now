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
