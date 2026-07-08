# Animation Asset Format

## Overview

Each gesture is stored as a JSON file in `public/animations/`.
Files are named by the gesture label with underscores replacing spaces
(e.g., `THANK_YOU.json`, `GOOD_MORNING.json`).

## Schema

```json
{
  "label": "HELLO",
  "language": "FSL",
  "fps": 30,
  "duration": 4000,
  "totalFrames": 120,
  "frames": [
    {
      "timestamp": 0,
      "landmarks": [
        {
          "landmarks": [
            { "x": 0.0, "y": 0.0, "z": 0.0 },
            { "x": 0.15, "y": -0.08, "z": -0.02 },
            ...
          ]
        }
      ]
    }
  ],
  "metadata": {
    "signerId": "S17",
    "source": "fsl_unified",
    "featureDimension": 126,
    "sequenceLength": 120,
    "handedness": "right",
    "version": 1
  }
}
```

## Fields

| Field | Type | Description |
|-------|------|-------------|
| `label` | string | Gesture label (uppercase) |
| `language` | string | Sign language code ("FSL") |
| `fps` | number | Frames per second of the capture |
| `duration` | number | Total duration in milliseconds |
| `totalFrames` | number | Number of frames in the array |
| `frames` | array | Array of animation frames |
| `frames[].timestamp` | number | Frame timestamp in ms |
| `frames[].landmarks` | array | Array of hands (0 or 1 per hand) |
| `frames[].landmarks[].landmarks` | array | 21 MediaPipe landmarks [{x,y,z}] |

## Landmark Format

Each hand has 21 landmarks following the MediaPipe hand landmark model:
- 0: Wrist
- 1-4: Thumb (CMC, MCP, IP, Tip)
- 5-8: Index finger (MCP, PIP, DIP, Tip)
- 9-12: Middle finger (MCP, PIP, DIP, Tip)
- 13-16: Ring finger (MCP, PIP, DIP, Tip)
- 17-20: Little finger (MCP, PIP, DIP, Tip)

Coordinate values are normalized to approximate MediaPipe output range.
The renderer maps them to canvas coordinates.

## Generated From

Assets are generated from the processed landmark datasets
(`datasets/processed/fsl_105/` and `datasets/processed/fsl_alphabet_v2/`)
using `scripts/generate-animation-assets.mjs`.
