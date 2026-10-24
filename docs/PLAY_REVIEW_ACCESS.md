# Google Play review access checklist

Keep reviewer credentials in Play Console's **App access** form or another secure password manager. Do not commit passwords to this repository.

Before submitting for review:

1. Create a dedicated review account using the production app's normal sign-up flow.
2. Verify the account and confirm it can sign in without a one-time code, invitation, location restriction, or approval from the developer.
3. Complete its profile so it can send messages and requests. Add a realistic test request and, if review needs to cover group chat, a second test account that has already joined that request.
4. Confirm the credentials remain valid for Google reviewers and are not used for real user data.
5. In Play Console **App access**, state that users must sign in and provide credentials and steps for reaching nearby requests, chat, media, and location features. Explain how to handle the location prompt; provide a location-independent test account/request if needed.

The app routes needed for the policy disclosures are `/privacy`, `/terms`, and `/account-deletion`. After the website is deployed, use its public HTTPS account-deletion URL in Play Console, for example `https://YOUR-PRODUCTION-DOMAIN/account-deletion`.

## Backend deployment

Apply `supabase/migrations/20261025120000_play_store_compliance.sql`, then deploy the account deletion function:

```sh
npx supabase functions deploy delete-account
```

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions. Never expose or commit the service-role key.

To grant a trusted operator access to `/moderation`, set that user's Supabase Auth **app_metadata** role to `moderator` or `admin` using a trusted server-side/admin tool. Do not let the client edit this claim.
