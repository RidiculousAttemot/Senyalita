# Communication Bridge Evaluation

## Evaluation Objective

Assess the effectiveness of SignLangVisual as a communication bridge between Deaf/Hard-of-Hearing (DHH) FSL users and hearing non-FSL users.

## Metrics

### Primary Metrics

| Metric | Measurement | Target |
|--------|-------------|--------|
| **Gesture recognition accuracy** | % of gestures correctly identified | ≥80% |
| **Communication success rate** | % of ended sessions with `communication_success = true` | ≥80% |
| **Conversation completion rate** | % of sessions with ≥3 exchanges | ≥60% |
| **Avg response time** | Time from signer message to responder reply | <30s |
| **Context reply relevance** | % of suggested replies that match conversation context | ≥70% |

### Secondary Metrics

| Metric | Measurement | Target |
|--------|-------------|--------|
| **Sessions per user** | Avg number of conversation sessions per user | ≥2 (repeat usage) |
| **Avg session duration** | Time from first to last message | 2-10 min |
| **Selected reply rate** | % of responder messages that use suggested replies | ≥40% |
| **TTS adoption** | % of sessions with TTS enabled | ≥30% |
| **Guided mode adoption** | % of sessions with guided mode toggled on | ≥20% |

## Test Scenarios

### Scenario A: Greeting Exchange

1. Signer performs "GOOD MORNING" 
2. System recognizes and appends message
3. Hearing user selects "Good morning to you too" from replies
4. Signer performs "THANK YOU"
5. Hearing user selects "You're welcome"
6. **Expected**: 2 exchanges, both parties understand the conversation

### Scenario B: Question & Answer

1. Signer performs "HOW ARE YOU"
2. System recognizes and appends
3. Hearing user selects "I'm fine, thank you"
4. Signer performs "IM FINE"
5. **Expected**: Question-answered successfully

### Scenario C: Assistance Request

1. Signer performs "HELP"
2. System recognizes and appends
3. Hearing user selects "How can I help?"
4. Signer performs "PLEASE"
5. Hearing user selects "Of course"
6. **Expected**: Assistance requested and offered

### Scenario D: Multi-Turn Conversation

1. Signer performs "HELLO"
2. Hearing user: "Hello! How are you?"
3. Signer performs "IM FINE"
4. Hearing user: "Glad to hear it"
5. Signer performs "NICE TO MEET YOU"
6. Hearing user: "Nice to meet you too"
7. Signer performs "GOODBYE"
8. Hearing user: "Goodbye! Take care"
9. **Expected**: 4 exchanges, natural flow, rated as success

## Data Collection

### Automatic Analytics

The `/admin/conversations` dashboard collects:

```
Total sessions:       Count of all conversation_sessions
Active/Ended:         Session status breakdown
Avg duration:         Average session length in minutes
Total messages:       Sum of all conversation_messages
Success rate:         % of ended sessions with communication_success = true
Top gestures:         Most frequently recognized gesture_labels
Top replies:          Most frequently sent reply text
Recent sessions:      Last 20 sessions with details
```

### User Feedback

At session end, users are prompted:
> Did the conversation communicate successfully? [Yes] [No]

This binary feedback is stored in `conversation_sessions.communication_success`.

### Manual Evaluation

For thesis evidence:

1. **Screen recordings**: Record the `/conversation` page during a 5+ turn conversation
2. **Transcript exports**: TXT exports saved to `docs/evidence/conversations/`
3. **Screenshots**: Capture the 3-panel layout with an active conversation
4. **User testing logs**: Document feedback from DHH users and hearing users

## Evaluation Protocol

### Single-User (Development) Test

```
1. Open /conversation
2. Perform 5 different FSL signs
3. For each sign:
   a. Wait for recognition ( ≤2s )
   b. Verify text is correct
   c. Click a suggested reply
4. End session, rate success
5. Review transcript
```

### Two-User (Paired) Test

```
1. Device A (Signer): opens /conversation with camera
2. Device B (Listener): watches the same screen (shared display or Realtime sync)
3. Signer performs 5+ signs
4. Listener reads transcript and selects replies
5. Both users rate communication success
```

## Expected Outcomes

| Scenario | Metric | Expected |
|----------|--------|----------|
| Greeting (A) | Recognition accuracy | ≥90% (common phrases) |
| Question (B) | Recognition accuracy | ≥80% |
| Assistance (C) | Recognition accuracy | ≥85% |
| Multi-turn (D) | Completion rate | ≥70% |
| All scenarios | Communication success | ≥80% |
| All scenarios | Response time | <20s per turn |

## Limitations

1. **Single-user mode**: Both signer and responder share one device/display
2. **Vocabulary**: Limited to 133 model labels
3. **Lighting/background**: Affects MediaPipe hand detection
4. **Connectivity**: Requires internet for Supabase (camera + model are local)
5. **Video responses**: Response video content requires manual upload via admin panel

## Success Criteria

Phase 12 is considered successful when:

- ✅ All 10 features are implemented and available in production build
- ✅ `/conversation` supports a complete 2-way conversation workflow
- ✅ `/presentation` displays recognized gestures in full-screen with TTS
- ✅ All 90 tests pass, lint passes, build passes
- ✅ Admin conversations dashboard shows meaningful analytics
- ✅ Audit script runs and produces coverage report
