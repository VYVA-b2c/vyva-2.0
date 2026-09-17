---
name: UI verification
description: Limits of unauthenticated preview screenshots when checking protected screens.
---

Do not claim a protected screen was visually verified when a preview screenshot shows only the splash or sign-in screen.

**Why:** Preview captures have repeatedly stopped at the splash while authentication requests returned 401. A running server or successful page response does not demonstrate that the requested UI rendered.

**How to apply:** Use an authenticated browser session for visual verification when available. Otherwise report the specific automated checks that passed and state the visual-verification limitation.