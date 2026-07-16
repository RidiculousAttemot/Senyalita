# Senyalita Translation Reference Layout Design

## Goal
Recreate the supplied reference layouts for Senyalita's Sign-to-Text and Type-to-Sign workspaces while preserving existing camera recognition and sign-animation behavior.

## Scope
- Retain the existing cream and terracotta palette for this pass.
- Keep all translation, camera, speech, and animation behavior unchanged.
- Replace `SignBridge` with `Senyalita` wherever the workspace label is visible.

## Sign-to-Text
- Use a wide two-column workspace: camera and transcript workspace on the left, stacked guidance panels on the right.
- Place camera status and actions inside the video surface.
- Put the recognized-character transcript, speech controls, spacing action, and clear action in a compact panel directly below the camera.
- Include guidance, recognition-language, transcript, and supported-character panels in the sidebar.

## Type-to-Sign
- Use the same two-column workspace.
- Place text input, primary action, language selector, speech action, and quick phrases above the preview.
- Present the animation preview as the principal working surface, with theme selection immediately below it.
- Retain a concise hearing-partner guide and supported-character panel in the sidebar.

## Acceptance Criteria
- The resulting hierarchy, spacing, and panel arrangement closely match the supplied screenshots at desktop width.
- Both modes remain responsive on mobile.
- Existing recognition and animation interactions continue to work.
