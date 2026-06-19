# Final Demonstration Script

## Setup

- **Device**: Laptop with webcam (720p+)
- **Browser**: Chrome (latest)
- **Network**: Stable internet connection
- **Display**: 1920×1080 external monitor preferred
- **Audio**: Speakers or headphones for TTS demo
- **Lighting**: Well-lit environment, no backlight

Total estimated time: **10 minutes**

---

## Demo Sequence

### 0. Opening (30s)

> "Good morning/afternoon. Today I will demonstrate SignLangVisual, a real-time Filipino Sign Language recognition and communication system."

---

### 1. Login (45s)

| Time | Action | Screen | Narration |
|------|--------|--------|-----------|
| 0:00 | Open browser, navigate to app URL | Landing page | "We start at the landing page" |
| 0:15 | Click Login | Login form | "Logging in with a demo account" |
| 0:30 | Enter credentials, submit | Dashboard | "As you can see, authentication works seamlessly" |

---

### 2. Open Camera (45s)

| Time | Action | Screen | Narration |
|------|--------|--------|-----------|
| 0:45 | Click Camera button in nav | Camera page | "Opening the camera page" |
| 0:55 | Camera activates | Live feed | "The browser requests camera permission" |
| 1:10 | Hand landmarks appear | Canvas overlay | "MediaPipe detects 21 hand landmarks in real-time" |
| 1:20 | FPS counter visible | Debug overlay | "Running at 30 FPS" |

---

### 3. Recognize Alphabet Sign (60s)

| Time | Action | Screen | Narration |
|------|--------|--------|-----------|
| 1:30 | Sign letter "A" | Recognition shows "A" | "Performing the FSL sign for letter A" |
| 1:40 | Sign letter "B" | Shows "B" | "Letter B — recognized at 95% confidence" |
| 1:50 | Sign letter "C" | Shows "C" | "Letter C" |
| 2:00 | Sign "THANK YOU" | Shows "THANK YOU" | "Now a common phrase — it translates in real-time" |

---

### 4. Recognize Phrase Sign (60s)

| Time | Action | Screen | Narration |
|------|--------|--------|-----------|
| 2:15 | Sign "HELLO" | Shows "HELLO" | "The model can recognize 133 different gestures" |
| 2:25 | Sign "GOOD MORNING" | Shows "GOOD MORNING" | "Good Morning — this is one of 106 phrase classes" |
| 2:35 | Sign "HOW ARE YOU" | Shows "HOW ARE YOU" | "How are you" |
| 2:45 | Sign "IM FINE" | Shows "IM FINE" | "I'm fine" |
| 2:55 | Sign "GOODBYE" | Shows "GOODBYE" | "Goodbye" |

---

### 5. Show Suggested Replies (45s)

| Time | Action | Screen | Narration |
|------|--------|--------|-----------|
| 3:00 | Sign "THANK YOU" again | Transcript + replies | "When a gesture is recognized, context-aware replies appear" |
| 3:15 | Point to reply chips | "You're welcome", etc. | "These are automatically generated from the database" |
| 3:30 | Click "You're welcome" | Reply appended | "One click sends the response" |

---

### 6. Play Response Video (45s)

| Time | Action | Screen | Narration |
|------|--------|--------|-----------|
| 3:45 | Sign "HELLO" | Reply with ▶ FSL button | "Some replies have FSL response videos" |
| 3:55 | Click ▶ FSL button | Video modal opens | "A video demonstrates the FSL response" |
| 4:10 | Video plays | FSL demonstration | "This helps hearing users respond in sign language" |

---

### 7. Start Conversation Session (120s)

| Time | Action | Screen | Narration |
|------|--------|--------|-----------|
| 4:30 | Navigate to `/conversation` | 3-panel layout | "The conversation page has three panels" |
| 4:45 | Sign "HELLO" | Auto-appended center | "Left: camera, Center: transcript, Right: session info" |
| 5:00 | Click reply "Hello! How are you?" | Reply appears | "The hearing user can respond with one click" |
| 5:15 | Sign "IM FINE" | Appended | "The conversation flows naturally" |
| 5:30 | Click "Glad to hear it" | Appended | "Multiple exchanges in real-time" |
| 5:45 | Enable Guided Mode | Badge shows ON | "Guided mode prevents duplicate predictions" |
| 6:00 | Sign "THANK YOU" | Locked prediction | "The prediction locks until you release it" |

---

### 8. Export Transcript (30s)

| Time | Action | Screen | Narration |
|------|--------|--------|-----------|
| 6:30 | Click Export TXT | File downloads | "The entire conversation can be exported" |
| 6:45 | Open exported file | Text file | "All messages are timestamped with sender information" |

---

### 9. View Analytics (45s)

| Time | Action | Screen | Narration |
|------|--------|--------|-----------|
| 7:00 | Open admin menu | Admin overview | "Switching to admin view" |
| 7:10 | Click Analytics | Analytics dashboard | "The analytics dashboard shows recognition statistics" |
| 7:25 | Scroll through charts | Top gestures, daily activity | "Top gestures, user activity, confidence rates" |
| 7:35 | Click Conversations | Conversation analytics | "Conversation-specific metrics" |

---

### 10. Open Admin Dashboard (45s)

| Time | Action | Screen | Narration |
|------|--------|--------|-----------|
| 8:00 | Click Gestures | Gesture list | "The admin can manage all 133 gestures" |
| 8:15 | Click Users | User management | "User roles and permissions" |
| 8:25 | Click Imports | Import tool | "Bulk import from model labels" |

---

### Closing (30s)

| Time | Action | Screen | Narration |
|------|--------|--------|-----------|
| 8:45 | Return to home | Landing page | "That concludes the demonstration" |
| 9:00 | — | — | "SignLangVisual is deployed, validated, and ready for real-world use. I welcome your questions." |

---

## Timing Summary

| Segment | Duration |
|---------|----------|
| Opening | 0:30 |
| Login | 0:45 |
| Open camera | 0:45 |
| Alphabet recognition | 1:00 |
| Phrase recognition | 1:00 |
| Suggested replies | 0:45 |
| Response video | 0:45 |
| Conversation session | 2:00 |
| Export transcript | 0:30 |
| View analytics | 0:45 |
| Admin dashboard | 0:45 |
| Closing | 0:30 |
| **Total** | **~10 minutes** |

## Contingency Plan

- **Camera fails**: Pre-recorded demo video ready
- **Model fails to load**: Have screenshots of all features
- **Network issues**: Local dev server as fallback
- **Time pressure**: Skip segments 5, 6 (reply + video), focus on recognition + conversation
