# Conversation Memory 2.0

## Overview

Conversation Memory 2.0 replaces the simple message-ring-buffer (last 10 messages) with a full conversation state machine. It maintains current topic, previous questions and replies, conversation state, and dynamically adjusts suggestion priorities based on conversation context.

## Architecture

Implemented in `src/features/conversation/conversationMemoryV2.ts`.

### Key Components

- **ConversationMemoryV2** — Main class for conversation state management
- **ConversationState** — Finite state machine (idle, greeting, introduction, questioning, etc.)
- **ConversationTopic** — Topic tracking with confidence decay
- **QuestionEntry** — Tracks unanswered questions for context-aware replies
- **ReplyEntry** — Tracks reply acceptance history
- **MessageEntry** — Full message history with intent classification

### Conversation States

```
idle → greeting → introduction → questioning → responding → farewell
                    ↓               ↓
                 requesting     food_discussion
                    ↓          healthcare
                 emergency     education
                               transportation
```

## Features

### Current Topic Tracking
- Maintains the current conversation topic with confidence scoring
- Topic confidence decays when new topics are introduced
- Topics with high mention counts are prioritized for suggestions

### Question Tracking
- Detects questions from user input
- Tracks unanswered questions with context
- Prioritizes replies that answer pending questions
- Example: After "How are you?", suggestions prioritize wellbeing responses

### Reply Acceptance History
- Records which replies were accepted by the user
- Tracks what each reply was responding to
- Learns user preferences over time

### Smart Priority Suggestions

The system automatically identifies what should be suggested next:

| Context | Priority Suggestions |
|---------|---------------------|
| Greeting → "How are you?" | "I'm fine", "How about you?", wellbeing check |
| Question unanswered | Direct answer, clarification, follow-up |
| Farewell | "See you later", "Take care", "Goodbye" |
| Food discussion | Food recommendations, restaurant suggestions |
| Emergency | Help, hospital, assistance options |

## Usage Example

```typescript
const memory = new ConversationMemoryV2();

// User says HELLO
memory.addMessage("user", "Hello", "Greeting", 0.95);
// State → greeting, topic → Greeting

// User says HOW ARE YOU
memory.addMessage("user", "How are you", "Question", 0.9);
// State → questioning, topic → Question
// Question tracked: "How are you" (unanswered)

// Assistant replies "I'm fine, thank you"
memory.addMessage("assistant", "I'm fine, thank you", "Response", 0.92);
// Question marked as answered
// Reply tracked: "I'm fine, thank you"

// Get suggested priorities
const priorities = memory.getSuggestedPriorities();
// Returns: ["That's good to hear", "I'm glad you're okay", "How about you?"]
```

## API

### Core Methods

| Method | Description |
|--------|-------------|
| `addMessage(speaker, text, intent, confidence, gestureLabel?)` | Add message to memory |
| `markReplyAccepted(replyText)` | Mark a reply as accepted |
| `markQuestionAnswered(question)` | Mark a question as answered |
| `getCurrentTopic()` | Get current conversation topic |
| `getConversationState()` | Get current state (idle/greeting/questioning/etc.) |
| `getUnansweredQuestions()` | List unanswered questions |
| `getRecentQuestions(count)` | Get recent N questions |
| `getRecentReplies(count)` | Get recent N replies |
| `getRecentMessages(count)` | Get recent N messages |
| `getSuggestedPriorities()` | Get context-aware priority suggestions |
| `getFullContext()` | Get complete conversation context snapshot |
| `reset()` | Reset all state |

## File Created

- `src/features/conversation/conversationMemoryV2.ts`

## Integration

The ConversationMemoryV2 is designed to work alongside the existing ContextMemory. It provides enhanced context while maintaining backward compatibility. The ConversationAssistant class can use ConversationMemoryV2 for improved suggestion quality while continuing to support the original interface.
