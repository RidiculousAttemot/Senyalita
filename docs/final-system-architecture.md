# Final System Architecture

## Overview

SignLangVisual is a browser-based Filipino Sign Language (FSL) recognition and communication platform. The entire application runs on the client side with a Supabase backend for auth, data persistence, and realtime sync.

---

## 1. Frontend Architecture

```mermaid
graph TD
    subgraph "Next.js 14 (App Router)"
        A["Landing (/)"]
        B["Camera (/camera)"]
        C["Conversation (/conversation)"]
        D["Presentation (/presentation)"]
        E["History (/history)"]
        F["Evaluation (/evaluation)"]
        G["Admin (/admin/*)"]
        H["Auth (/login, /register, /profile)"]
    end

    subgraph "Shared Hooks & Utils"
        I["useRecognition"]
        J["MediaPipe Hands"]
        K["TF.js Model"]
        L["TTS (Web Speech API)"]
        M["Supabase Client"]
    end

    subgraph "Feature Modules"
        N["Recognition Pipeline"]
        O["Conversation System"]
        P["Logging System"]
        Q["Gesture Library"]
    end

    A --> M
    B --> I
    B --> J
    B --> K
    C --> I
    C --> J
    C --> K
    C --> L
    D --> I
    D --> J
    D --> K
    D --> L
    E --> P
    E --> M
    F --> P
    G --> M
    G --> Q
    H --> M

    I --> N
    I --> P
    O --> C
    O --> M
    P --> M
    Q --> M
    Q --> G
```

---

## 2. Recognition Pipeline

```mermaid
flowchart LR
    A["Camera (getUserMedia)"] --> B["MediaPipe Hands"]
    B --> C["Landmark Extraction\n(21 pts × 2 hands)"]
    C --> D["Normalization\n(wrist-centered, max-abs)"]
    D --> E["Sequence Buffer\n(30 timesteps × 126 feat)"]
    E --> F["TF.js BiLSTM Inference\n(133 classes)"]
    F --> G["Smoothing\n(5-frame rolling, hysteresis)"]
    G --> H["Translation\n(label → display text)"]
    H --> I["UI Output"]

    J["MotionDetector\n(idle/gesturing state)"] --> E
    J --> F
```

### Components

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Camera | `navigator.mediaDevices.getUserMedia` | 640×480 video stream |
| Hand Tracking | `@mediapipe/hands` | 21 landmarks per hand |
| Landmark Normalization | `normalize.ts` | Wrist-centered, max-abs scaling → 126-dim vector |
| Temporal Buffer | `buffer.ts` | Ring buffer, samples 30 timesteps for model input |
| Motion Detection | `motionDetection.ts` | Inter-frame displacement analysis |
| Model Inference | TF.js (WebGL backend) | 133-class BiLSTM, loaded from `/public/models/` |
| Smoothing | `smoothing.ts` | 5-frame rolling majority vote + 0.10 hysteresis |
| Translation | `translation.ts` | DB label → human-readable display text |

---

## 3. Conversation Pipeline

```mermaid
flowchart TB
    subgraph "Signer (Deaf/HoH User)"
        A["Perform FSL Sign"] --> B["Camera + MediaPipe"]
        B --> C["Recognition Pipeline"]
        C --> D{"Confidence ≥ 0.7?"}
        D -->|Yes| E{"Cooldown ≥ 2s?"}
        E -->|Yes| F["Insert conversation_messages\n(sender_type: signer)"]
        F --> G["Update UI Transcript"]
        G --> H["Fetch Context Replies\n(gesture_reply_relationships)"]
        H --> I["Display Reply Suggestions"]
    end

    subgraph "Hearing User"
        J["View Transcript"] --> K{"Choose Response"}
        K --> L["Click Suggested Reply"]
        K --> M["Type Custom Reply"]
        K --> N["Play Response Video"]
        L --> O["Insert conversation_messages\n(sender_type: responder)"]
        M --> O
        O --> P["Update UI Transcript"]
        P --> Q["TTS Output (optional)"]
        Q --> R["Guided Mode: Release Lock"]
    end

    subgraph "Supabase Backend"
        S["conversation_sessions"]
        T["conversation_messages"]
        U["gesture_reply_relationships"]
        F --> S
        F --> T
        O --> T
        H --> U
    end
```

### Conversation States

```mermaid
stateDiagram-v2
    [*] --> Idle: Session Created
    Idle --> Gesturing: Motion Detected
    Gesturing --> Recognizing: Buffer ≥ threshold
    Recognizing --> Appended: Confidence ≥ 0.7
    Appended --> AwaitingReply: Cooldown active
    AwaitingReply --> Idle: Reply received
    Appended --> Idle: Guided mode reset
    Idle --> [*]: Session ended
    AwaitingReply --> [*]: Session ended
```

---

## 4. Database Schema

```mermaid
erDiagram
    PROFILES {
        uuid id PK
        text display_name
        text role
        text avatar_url
        timestamp created_at
    }

    TRANSLATION_SESSIONS {
        uuid id PK
        uuid user_id FK
        timestamp started_at
        timestamp ended_at
        int total_predictions
        float avg_confidence
        float avg_inference_ms
        float avg_fps
    }

    TRANSLATION_LOGS {
        uuid id PK
        uuid session_id FK
        text gesture_label
        float confidence
        float inference_time_ms
        int fps
        timestamp created_at
    }

    CONVERSATION_SESSIONS {
        uuid id PK
        uuid user_id FK
        timestamp started_at
        timestamp ended_at
        text status
        text participant_name
        int total_messages
        boolean communication_success
    }

    CONVERSATION_MESSAGES {
        uuid id PK
        uuid session_id FK
        text sender_type
        text gesture_label
        text translated_text
        numeric confidence
        uuid reply_to_message_id FK
        boolean is_selected_reply
        timestamp created_at
    }

    GESTURES {
        uuid id PK
        text label UK
        text description
        text video_path
        text thumbnail_path
        boolean is_active
        int display_order
    }

    GESTURE_REPLIES {
        uuid id PK
        uuid gesture_id FK
        text reply_text
        int display_order
        boolean is_active
    }

    GESTURE_REPLY_RELATIONSHIPS {
        uuid id PK
        text gesture_label
        text suggested_reply
        int priority
        text[] context_tags
        boolean is_active
        text response_video_url
    }

    TRANSCRIPTS {
        uuid id PK
        uuid user_id FK
        text content
        timestamp created_at
    }

    PROFILES ||--o{ TRANSLATION_SESSIONS : "has"
    PROFILES ||--o{ CONVERSATION_SESSIONS : "has"
    PROFILES ||--o{ TRANSCRIPTS : "has"
    TRANSLATION_SESSIONS ||--o{ TRANSLATION_LOGS : "contains"
    CONVERSATION_SESSIONS ||--o{ CONVERSATION_MESSAGES : "contains"
    CONVERSATION_MESSAGES ||--o{ CONVERSATION_MESSAGES : "reply_to"
    GESTURES ||--o{ GESTURE_REPLIES : "has"
    GESTURE_REPLY_RELATIONSHIPS }o--|| GESTURES : "maps_to"
```

---

## 5. Supabase Architecture

```mermaid
graph TD
    subgraph "Supabase Project"
        A["Auth\n(Email/Password)"]
        B["Database\n(PostgreSQL)"]
        C["Storage\n(gesture-videos, reply-videos)"]
        D["Realtime\n(WebSocket)"]
    end

    subgraph "Database Tables"
        E["profiles"]
        F["translation_sessions"]
        G["translation_logs"]
        H["gestures"]
        I["gesture_replies"]
        J["gesture_reply_relationships"]
        K["conversation_sessions"]
        L["conversation_messages"]
        M["transcripts"]
        N["audit_log"]
    end

    subgraph "RLS Policies"
        O["User owns own data"]
        P["Admin sees all"]
        Q["Public read for gestures"]
        R["Role-based insert/update"]
    end

    subgraph "Functions"
        S["is_admin()"]
        T["increment_conv_message_count()"]
        U["get_admin_analytics()"]
    end

    A --> E
    B --> E
    B --> F
    B --> G
    B --> H
    B --> I
    B --> J
    B --> K
    B --> L
    B --> M
    B --> N
    C --> H
    C --> I
    D --> L
    D --> F
    E --> O
    E --> P
    H --> Q
    H --> R
    E --> S
    K --> T
    F --> U
```

---

## 6. Deployment Architecture

```mermaid
graph LR
    subgraph "Vercel (Production)"
        A["Next.js App\n(Edge + Serverless)"]
        B["Middleware\n(Auth checks)"]
        C["API Routes\n(Serverless Functions)"]
    end

    subgraph "Supabase"
        D["Auth Service"]
        E["PostgreSQL Database"]
        F["Storage Buckets"]
        G["Realtime Service"]
    end

    subgraph "Client Browser"
        H["MediaPipe Hands\n(WebAssembly)"]
        I["TF.js Model\n(WebGL)"]
        J["Web Speech API\n(TTS)"]
    end

    subgraph "External CDN"
        K["MediaPipe CDN\n(jsdelivr)"]
        L["Static Assets\n(Vercel Edge)"]
    end

    H --> K
    A --> D
    A --> E
    A --> F
    B --> D
    C --> E
    C --> F
    A --> G
```

### Deployment Characteristics

| Aspect | Detail |
|--------|--------|
| **Hosting** | Vercel (Pro) |
| **Region** | Auto (nearest edge) |
| **Runtime** | Node.js 18+ |
| **Database** | Supabase (PostgreSQL 15) |
| **Auth** | Supabase Auth (GoTrue) |
| **Storage** | Supabase Storage (S3-compatible) |
| **Realtime** | Supabase Realtime (WebSocket) |
| **ML Runtime** | TensorFlow.js (browser WebGL) |
| **Hand Tracking** | MediaPipe Hands (WASM) |
| **CI/CD** | Vercel GitHub Integration |

---

## 7. AI/ML Workflow

```mermaid
flowchart LR
    subgraph "Training Pipeline (Python)"
        A["FSL Dataset\n(Kaggle + Custom)"]
        B["Preprocessing\n(landmark extraction)"]
        C["Data Augmentation\n(noise, rotation, scaling)"]
        D["Model Training\n(Keras BiLSTM)"]
        E["Export to TF.js\n(tensorflowjs_converter)"]
    end

    subgraph "Browser Inference (TF.js)"
        F["Load Model\n(tf.loadGraphModel)"]
        G["Preprocess Input\n(30×126 tensor)"]
        H["Run Inference\n(model.predict)"]
        I["Post-process\n(softmax → top-K)"]
    end

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I
```

### Model Specs

| Property | Value |
|----------|-------|
| **Architecture** | BiLSTM (Bidirectional LSTM) |
| **Input shape** | (30, 126) — 30 timesteps × 126 features |
| **Output shape** | (133,) — 133 class probabilities |
| **Total params** | ~250K |
| **Framework** | TensorFlow / Keras (Python) → TF.js (browser) |
| **Quantization** | Float32 |
| **File size** | ~2 MB (model.json + weight shards) |
| **Labels** | 27 alphabet + 106 phrases = 133 total |

---

## 8. Data Flow Summary

```
User performs sign
  → Camera captures video (30fps)
    → MediaPipe detects hand landmarks
      → Landmarks normalized (126-dim vector)
        → Appended to temporal buffer (30 frames)
          → TF.js BiLSTM inference (every 100ms)
            → Softmax → 133-class probabilities
              → Top-K extraction (K=5)
                → Prediction smoothing (5-frame rolling)
                  → Translation (label → display text)
                    → UI update (confidence, transcript)
                      → If ≥ 0.7 confidence + cooldown:
                        → Auto-append to conversation
                          → Fetch context-aware replies
                            → Hearing user sees + responds
```

---

## 9. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Client-side ML** | No server GPU needed; privacy (video never leaves device) |
| **Local-first storage** | Works offline; Supabase for sync + sharing |
| **MediaPipe Hands** | Mature, fast, cross-browser hand tracking |
| **TF.js WebGL backend** | GPU acceleration in browser |
| **BiLSTM over Transformer** | Smaller model size, faster inference, sufficient accuracy |
| **Supabase over Firebase** | SQL queries, PostgreSQL ecosystem, lower cost |
| **Next.js App Router** | Modern React patterns, server components, edge runtime |
| **2s cooldown** | Prevents duplicate spam during held gestures |
| **0.7 confidence threshold** | Balances accuracy vs. missed detections |
| **Context replies separate table** | Admin-manageable, not tied to model retraining |
