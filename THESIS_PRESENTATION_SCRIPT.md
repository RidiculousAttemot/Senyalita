# Thesis Presentation Script

Title: Real-Time Sign Language Recognition and Translation System Using Deep Learning for Text and Speech Output

Good day panelists, professors, and fellow students.
We are the proponents of the study entitled:
"Real-Time Sign Language Recognition and Translation System Using Deep Learning for Text and Speech Output."
Our study focuses on developing a web-based system that recognizes sign language gestures in real time and translates them into text and optional speech using deep learning.

## Introduction
Communication is essential in daily life, yet Deaf and hard-of-hearing individuals often face barriers when interacting with people who do not know sign language. To address this gap, we developed SignBridge, a real-time sign language recognition and translation platform that uses AI to convert hand gestures into readable text and audible speech. The main goal of the study is to improve accessibility, communication efficiency, and inclusivity.

## Objectives of the Study
- Develop a real-time sign language recognition system.
- Translate recognized gestures into text and speech outputs in English or Tagalog.
- Evaluate the system using ISO/IEC 25010 software quality standards.
- Assess usability, reliability, functionality, and performance efficiency.

## Significance of the Study
This study benefits:
- Deaf and hard-of-hearing individuals through improved communication.
- Teachers and interpreters through assistive translation support.
- Researchers and developers by contributing to AI-based assistive tools.
- Future developers through a foundation for extension and improvement.

## Methodology
Development began with the frontend camera pipeline and MediaPipe landmarks to ensure real-time processing before adding backend services.
Phase 1 focuses on webcam capture, landmark rendering, and basic text output.
### Research Instrument
We used a Likert Scale questionnaire aligned with ISO/IEC 25010. Respondents evaluated:
- Functional suitability
- Usability
- Reliability
- Performance efficiency

Scale:
5 - Strongly Agree
4 - Agree
3 - Neutral
2 - Disagree
1 - Strongly Disagree

The questionnaire was validated by three experts. A pilot test with five participants ensured clarity and reliability.

### Data Gathering Procedure
- The system was demonstrated to respondents.
- The webcam captured hand gestures.
- The AI model analyzed gestures in real time.
- Text and speech outputs were displayed.
- Respondents answered the survey immediately after.
- Short interviews collected feedback on accuracy, usability, and responsiveness.

### Statistical Tools
- Frequency to count responses.
- Percentage to show distribution.
- Weighted mean to compute overall evaluation.

## Technical Requirements
### Hardware
- Laptop or desktop, minimum 8GB RAM
- Dual-core processor
- HD webcam
- Speakers or headphones
- Stable internet connection

Mobile target (future-ready):
- Octa-core processor
- 8GB RAM
- 128GB storage
- Dual camera

### Software Stack
- Frontend: Next.js with TypeScript
- CV/AI (client-side): MediaPipe Hands + TensorFlow.js
- Backend/API: Next.js API Routes
- Database: Supabase (PostgreSQL)
- Hosting: Vercel (free tier)
- Tools: Git, GitHub, Visual Studio Code

## API Specifications
- REST API: application data, logs, and user actions
- WebSocket API: low-latency updates for real-time UI state
- Text-to-Speech API: converts translated text into speech

## System Design
### Master System Blueprint
Camera Input
-> Preprocessing
-> Landmark Extraction
-> Deep Learning Recognition
-> Text and Speech Output

Reply Flow (Two-Way)
Translated text
-> User selects a reply phrase or types a response
-> Suggested reply clips appear
-> System plays a sign language video clip

Admin Flow (Reply Videos)
Admin uploads labeled sign language reply videos
-> Clips are used for reply suggestions

### Web Dashboard
- Live camera feed
- Transcript panel
- Start/Stop controls
- Export and Clear buttons
- Voice selection

## System Architecture
Five stages:
1. Camera input
2. Preprocessing
3. Feature extraction (MediaPipe landmarks)
4. Deep learning recognition (CNN-LSTM)
5. Output (text and speech)

The model also provides top-k suggestion outputs when confidence is high to help users confirm or correct recognition quickly.

The model processes landmark sequences and predicts the sign with confidence, then outputs text and optional speech.
The output language can be switched between English and Tagalog for accessibility.
The recognition model runs locally in the client, not through a remote inference API.

## Data Flow (Summary)
- User signs in front of the camera.
- System captures frames and extracts landmarks.
- AI model predicts the gesture.
- Translated text is displayed and optionally spoken.

## Development Model
We used the Agile Iterative Model.
This is ideal for AI systems because it supports repeated testing, retraining, and continuous improvement.

## Conclusion
The study delivered a real-time sign language recognition and translation system that converts gestures into text and speech. The system shows strong potential as an assistive communication tool and provides a foundation for future expansion. Thank you, and we are ready for your questions.

## Possible Panel Questions and Answers
1. Why did you choose this topic?
We chose this topic to reduce communication barriers and promote accessibility using AI.

2. Why use deep learning instead of traditional programming?
Deep learning adapts to gesture variability in angle, speed, and lighting better than rule-based methods.

3. Why use a web-based system?
Web deployment allows easy access, testing, and sharing without device-specific installation.

4. Why use MediaPipe Hands?
MediaPipe provides reliable real-time landmark extraction without custom detector training.

5. Why use Supabase?
Supabase provides a free PostgreSQL-backed platform with auth and storage that fits our scope.

6. What are the limitations?
Accuracy can drop under poor lighting or with gestures not in the dataset.

7. How do you handle incorrect predictions?
We use confidence thresholds and optional user verification to reduce incorrect outputs.

8. Why Agile?
Agile supports iterative model improvement and fast feedback cycles.

9. How was the system evaluated?
We used ISO/IEC 25010 with surveys, interviews, and weighted mean analysis.

10. Is the system production-ready?
It is a research prototype with strong potential for future deployment.

## Possible Flaws and Defenses
Flaw: Limited dataset
Defense: This is a prototype, and the system supports future retraining and dataset expansion.

Flaw: Lighting sensitivity
Defense: Preprocessing and normalization reduce lighting issues, but some limitations remain.

Flaw: Internet dependency
Defense: Core recognition runs locally; the internet is mainly for updates and cloud services.

Flaw: Limited gesture vocabulary
Defense: The scope focuses on a defined vocabulary for manageable training and evaluation.

Flaw: Accuracy concerns
Defense: Confidence scoring and verification reduce incorrect outputs.

## Strongest Defense Statement
Our study is a functional prototype and proof of concept. The goal was to demonstrate that deep learning can successfully perform real-time sign language recognition and translation. Despite limitations, the system achieved its objectives and provides a strong foundation for future development.
