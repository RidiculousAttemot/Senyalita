# Accessibility Report

## Features Implemented

### 1. Text Size Controls

Three sizes available via toggle buttons in the conversation page header:

| Size | Base Font Size | Use Case |
|------|---------------|----------|
| **Normal** | 16px | Default, standard readability |
| **Large** | 20px | Users with mild visual impairment |
| **Extra Large** | 28px | Users with significant visual impairment, or when viewed from distance |

The text size applies to:
- Conversation transcript messages
- Recognized gesture display
- Reply text

### 2. Dark Mode

- Inherits the existing theme system
- Dark background (#0a0a1a) with high-contrast text
- Color-coded message borders (green for signer, blue for responder)
- Consistent with the rest of the application

### 3. Text-to-Speech (TTS)

Powered by the Web Speech API via `src/lib/tts.ts`:

- **Auto TTS toggle**: when enabled, recognized gestures are automatically spoken
- **Language support**: English (en-US) and Filipino (fil-PH) voices
- **Rate control**: speech rate set to 0.9 for clear articulation
- **Singleton pattern**: voice preference persisted in localStorage
- **Fallback handling**: handles Chrome's async voice loading quirk

TTS triggers:
- When a gesture is auto-appended (≥0.7 confidence)
- When a reply is sent

### 4. Language Localization

Tagalog/English toggle switches:

| UI Element | English | Tagalog |
|------------|---------|---------|
| Signer label | "Deaf User" | "Bingi" |
| Responder label | "Hearing User" | "Tagatugon" |
| No sign text | "No sign detected" | "Walang nakitang senyas" |
| Send button | "Send" | "Ipadala" |
| Suggested replies header | "Suggested replies:" | "Mga mungkahing tugon:" |
| Frequent replies header | "Frequent:" | "Mga madalas:" |
| Session info header | "Session Info" | "Impormasyon ng Sesyon" |
| Shortcuts header | "Shortcuts" | "Mga Shortcut" |
| Communication success | "Communication Success" | "Tagumpay ng Komunikasyon" |
| Yes/No buttons | "Yes" / "No" | "Oo" / "Hindi" |
| Type reply placeholder | "Type a reply..." | "Mag-type ng tugon..." |
| Presentation mode label | "Presentation Mode" | "Presetasyon" |
| Export TXT shortcut label | "Export TXT" | "I-export" |

### 5. Keyboard Shortcuts

| Shortcut | Action | User Need |
|----------|--------|-----------|
| `Enter` | Send reply | Power users, screen reader users |
| `G` | Toggle guided mode | Quick mode switching |
| `T` | Toggle TTS | Hearing accessibility |
| `E` | Export conversation | Data export efficiency |

### 6. Presentation Mode (`/presentation`)

Full-screen display optimized for public settings:

- **Large text**: `clamp(48px, 10vw, 120px)` — readable from distance
- **High contrast**: bright green (#22c55e) for high-confidence, yellow for medium
- **Auto TTS**: speaks recognized gestures aloud
- **Minimal UI**: no distracting elements, only essential controls
- **Dark background**: reduces eye strain in dark environments

## WCAG Compliance

| WCAG Criterion | Status | Implementation |
|----------------|--------|---------------|
| 1.4.4 Resize text | ✅ | Text size controls (up to 28px) |
| 1.4.6 Contrast (Enhanced) | ✅ | Dark theme with high contrast colors |
| 1.4.10 Reflow | ✅ | Responsive grid layout, scrollable panels |
| 2.1.1 Keyboard | ✅ | G, T, E shortcuts |
| 2.4.3 Focus Order | ⚠️ | Mostly logical, could improve with tabindex |
| 3.1.1 Language of Page | ✅ | English + Tagalog toggle |
| 3.1.2 Language of Parts | ✅ | TTS uses correct language per toggle |

## Future Improvements

1. **Screen reader announcements**: Add ARIA live regions for recognition state changes
2. **Focus indicators**: Improve visible focus styles for keyboard navigation
3. **Voice input**: Allow hearing users to speak replies (Web Speech Recognition)
4. **Closed captions**: For response videos
5. **High contrast mode**: Dedicated high-contrast stylesheet
6. **Font selection**: Support dyslexic-friendly fonts
7. **Color blind mode**: Add patterns/icons alongside color indicators
