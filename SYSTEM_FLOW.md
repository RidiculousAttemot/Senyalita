# System Flow and User Roles

## Where to Begin
Start with the frontend. The core of this system is real-time camera capture and on-device recognition, which must work before backend services add value. Once the webcam pipeline is stable, add backend features like logging, user profiles, and analytics.

## User Roles
- Guest User: uses live translation without logging in
- Registered User: saves translation history and preferences
- Admin: manages datasets and monitors system health

## User Count (Planned)
- 3 roles (Guest, Registered, Admin)
- Guest is default for public access

## Authentication Flow
1. User opens the app.
2. Landing page shows a start button and optional login.
3. Guest can start translation immediately.
3. Optional login for saved history and settings.
4. Auth handled by Supabase (email/password or OAuth if enabled).

## Main System Flow (Core Translation)
1. User opens the camera page.
2. Browser requests webcam permission.
3. MediaPipe Hands extracts landmarks.
4. CNN-LSTM model predicts the sign label.
5. System maps label to text.
6. Text is displayed and spoken via text-to-speech.

## Data Flow (If Logged In)
1. User signs in.
2. Each prediction can be saved as a log entry.
3. History page loads logs from Supabase.
4. User can export or clear history.

## Key Screens
- Landing: start translation, short system intro, optional login
- Camera: live recognition and transcript
- History: saved translations and export
- Settings: language, voice, and preferences

## Backend Responsibilities
- Auth and user sessions (Supabase)
- Store translation logs
- Optional analytics or reporting

## Security
- Supabase Auth for user authentication
- API route validation on server side
- Role-based access for admin operations
- Environment-based secrets and config

## Notes
- Core translation runs client-side for low latency.
- Backend is optional at first; add after core works.
