# Conversation Workflow

## User Journey

### 1. Start a Conversation

1. Navigate to `/conversation`
2. Camera activates automatically (MediaPipe hand tracking)
3. A new `conversation_session` is created with `status = "active"`
4. The session ID appears in the right panel

### 2. Sign a Gesture (Deaf/HoH User)

1. The user performs an FSL sign in front of the camera
2. MediaPipe detects hand landmarks → landmarks are normalized → fed into the BiLSTM model
3. **Guided Mode OFF**: recognition runs continuously at 100ms intervals, auto-appends at ≥0.7 confidence with 2s cooldown
4. **Guided Mode ON**: waits for gesture start (motion), captures, then locks the prediction until released
5. The recognized text appears in the left panel with confidence percentage
6. If confidence ≥ 0.7, the message is auto-appended to the center transcript

### 3. Hearing User Responds

1. After a gesture is appended, context-aware reply suggestions appear below the transcript
2. The hearing user can:
   - Click a **suggested reply** chip — instantly sends as a responder message
   - Click **▶ FSL** button to watch the response in FSL (video modal)
   - **Type a custom reply** in the input field and press Enter
   - Click a **frequent reply** from the saved list
3. The reply appears in the transcript with blue styling

### 4. Continue the Conversation

1. After the hearing user replies:
   - **Guided Mode ON**: the prediction lock is released, ready for the next gesture
   - **Guided Mode OFF**: cooldown expires, next gesture is auto-appended
2. Repeat steps 2-4 for natural back-and-forth conversation

### 5. End the Conversation

1. Click "End" button in the header
2. Rate communication success (Yes/No)
3. Session is marked `status = "ended"` with `communication_success` and `ended_at` timestamp
4. Optionally export the conversation as TXT before ending

## Data Flow

```
Camera → MediaPipe → Landmarks → Normalize → Buffer (30 frames)
  → TF.js BiLSTM → Inference → Smoothing → Translation
  → Confidence ≥ 0.7? + Cooldown? → Insert conversation_messages row
  → Supabase Realtime → Update UI → Fetch context replies
  → Hearing user clicks reply → Insert responder message → Update UI
```

## Reply Sources

1. **`gesture_reply_relationships`** — exact gesture label match, ordered by priority (primary)
2. **`gesture_replies`** — fallback via gesture_id FK if no relationship exists
3. **Frequent replies** — `localStorage` tracking of the 5 most-clicked replies

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send custom reply (when input focused) |
| `G` | Toggle guided mode |
| `T` | Toggle TTS |
| `E` | Export conversation as TXT |

## Accessibility

- **Text size**: Normal / Large / Extra Large toggle
- **TTS**: Auto-speak recognized gestures (checkbox toggle)
- **Language**: Switch between English and Tagalog UI labels
- **Dark mode**: Inherits system theme (dark is default)

## Migration

Run `supabase/migrations/0016_response_videos.sql` to add:
- `response_video_url` column to `gesture_reply_relationships`
- `is_selected_reply` column to `conversation_messages`
