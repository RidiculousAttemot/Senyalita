# System Flow and User Roles

## Where to Begin
Start with the frontend. The core of this system is real-time camera capture and on-device recognition, which must work before backend services add value. Once the webcam pipeline is stable, add backend features like logging, user profiles, and analytics.

## First Build Target
- Landing page with Start button
- Camera page with live landmarks
- Text output panel with placeholder prediction

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

## Two-Way Communication Flow (Reply)
1. User reads the translated text.
2. User taps a Reply button.
3. System shows suggested reply phrases with video clips.
4. User selects a phrase (e.g., "thank you") or types a custom reply.
5. If a matching clip exists, a play button appears.
6. The system plays a short sign language video clip for the reply.
5. The signer sees the reply and continues the conversation.

## Admin Flow (Reply Video Management)
1. Admin signs in.
2. Admin uploads sign language reply videos with labels.
3. System saves clips for use in reply suggestions.

## Data Flow (If Logged In)
1. User signs in.
2. Each prediction can be saved as a log entry.
3. History page loads logs from Supabase.
4. User can export or clear history.

## Key Screens
- Landing: start translation, short system intro, optional login
- Camera: live recognition and transcript
- Reply: phrase picker and sign video playback
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
