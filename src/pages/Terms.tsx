import { Link } from "react-router-dom";

export default function Terms() {
  return <main className="min-h-dvh bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-600 px-4 py-10 text-white sm:px-6">
    <article className="mx-auto max-w-3xl space-y-5 rounded-3xl border border-white/25 bg-white/10 p-6 shadow-2xl backdrop-blur-2xl sm:p-10">
      <Link to="/" className="text-sm text-cyan-100 underline">Nearby Aid Now</Link>
      <h1 className="text-3xl font-bold">Terms of Use and Community Rules</h1>
      <p className="text-sm text-white/70">Effective October 25, 2026</p>
      <p>By creating or using an account, you agree to use Nearby Aid Now lawfully and respectfully. The app connects neighbors for community assistance and is not an emergency response service.</p>
      <h2 className="text-xl font-semibold">Community behavior</h2>
      <p>Do not post harassment, threats, hate, scams, illegal content, sexual exploitation, or another person’s private information. Do not misuse location, photos, videos, chat, or help requests. Share only content you have permission to share.</p>
      <h2 className="text-xl font-semibold">Safety and moderation</h2>
      <p>You may report users, requests, and messages, and block other users in the app. Reports are reviewed and may result in content removal or account restrictions. We may restrict access to protect users and comply with law.</p>
      <h2 className="text-xl font-semibold">Your content and account</h2>
      <p>You retain responsibility for content you submit and grant us permission to store and display it as needed to operate the service. You can request account deletion in Profile or on the <Link className="underline text-cyan-100" to="/account-deletion">account deletion page</Link>.</p>
      <h2 className="text-xl font-semibold">Contact</h2>
      <p>For help, use the support email shown on the Nearby Aid Now Google Play listing.</p>
      <p className="text-sm text-white/70">See our <Link className="underline text-cyan-100" to="/privacy">Privacy Policy</Link>.</p>
    </article>
  </main>;
}
