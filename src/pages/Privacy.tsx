import { Link } from "react-router-dom";

export default function Privacy() {
  return <main className="min-h-dvh bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-600 px-4 py-10 text-white sm:px-6">
    <article className="mx-auto max-w-3xl space-y-5 rounded-3xl border border-white/25 bg-white/10 p-6 shadow-2xl backdrop-blur-2xl sm:p-10">
      <Link to="/" className="text-sm text-cyan-100 underline">Nearby Aid Now</Link>
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-sm text-white/70">Effective October 25, 2026</p>
      <p>Nearby Aid Now helps people connect with nearby community members. This policy explains what information the app uses and how account deletion works.</p>
      <h2 className="text-xl font-semibold">Information we process</h2>
      <ul className="list-disc space-y-2 pl-6 text-white/85">
        <li>Account information such as email, name, phone number, address, profile photo, and social profile links that you provide.</li>
        <li>Device location, when you grant permission, to show nearby requests and community members. You can deny location access in device settings; nearby features may then be unavailable.</li>
        <li>Help requests, chat messages, replies, shared links, photos, videos, and locations you choose to post. If you choose the Medical category, your request may contain health information; avoid including details you do not want visible to people in that request chat.</li>
        <li>Ratings, feedback, reports, blocked-user choices, and notification registration tokens needed to provide and protect the service.</li>
      </ul>
      <h2 className="text-xl font-semibold">How it is used and shared</h2>
      <p>We use this information to operate nearby discovery, requests, chat, safety reporting, account profiles, and push notifications. Information you post may be visible to users who can access that request or chat. Profile information may be shown to other app users. We use Supabase for authentication, database, and media storage, and Firebase Cloud Messaging to deliver Android notifications. We do not sell personal information. Nearby Aid Now is not a healthcare provider or emergency response service.</p>
      <h2 className="text-xl font-semibold">Retention and deletion</h2>
      <p>You can request deletion from the app’s Profile page or use the <Link className="underline text-cyan-100" to="/account-deletion">account deletion page</Link>. Account deletion removes the account and associated profile, requests, messages, feedback, notification registrations, and uploaded media, subject to limited retention required for security, legal compliance, or resolving abuse reports.</p>
      <h2 className="text-xl font-semibold">Your choices and security</h2>
      <p>You can control location and notification permissions in Android settings. We use access controls and encrypted network connections to protect data. No online service can guarantee absolute security.</p>
      <h2 className="text-xl font-semibold">Contact</h2>
      <p>For privacy or account support, contact the developer using the support email shown on the Nearby Aid Now Google Play listing.</p>
      <p className="text-xs text-white/65">This policy should be reviewed against the production data flows and the developer’s legal obligations before release.</p>
    </article>
  </main>;
}
