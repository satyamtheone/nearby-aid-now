# Play Console Data safety preparation

Use this as a code-based inventory when completing Play Console. Verify it against production Supabase/Firebase settings, their current SDK disclosures, logging/retention, and any services configured outside this repository. The developer is responsible for the final declarations.

| Data area | App behavior to disclose/review |
| --- | --- |
| Personal information | Email/account ID; full name and username; phone; home/current address; social profile URLs; age/gender if the user supplies them. |
| Location | Foreground device coordinates and a derived location name; stored as the user's last location and used for nearby results and notifications within 10 km. A chat participant can also explicitly share a location. Assess whether to declare precise location; the browser flow requests high accuracy and the backend stores coordinates. |
| User content | Help request text/category, chat messages and replies, links, photos, videos, and feedback/ratings. A Medical request may include user-entered health details. Content can be visible to eligible users in the associated request/chat. |
| Device or other IDs | Firebase Cloud Messaging registration token used to deliver push notifications. |
| Safety data | User-submitted reports and block relationships. Reports are available to authorized moderators; report status and review metadata are retained. |
| Service providers | Supabase provides authentication, database, and object storage; Firebase Cloud Messaging delivers push notifications. Confirm their roles and current subprocessors/configuration. |

For each item in the Play Console form, confirm whether it is collected, shared, processed ephemerally, required or optional, encrypted in transit, and whether users can request deletion. The form's meanings and SDK handling determine the final answers; this inventory is not a completed declaration.
