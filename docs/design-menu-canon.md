# Page Types and Menu Canon

User decision, 6 October 2026: the main Menu (`/menu`, `MenuScreen.tsx`) is the visual source of truth for menu pages. Submenus use exactly the same visual language. Detail, task, form, and report pages are separate types and must not be converted into menus.

- Menu/submenu tiles: one column on mobile, two from the medium breakpoint; shared spacing, solid surfaces, typography, icon wells, and arrows.
- Submenus retain a back control in the same header position as the root menu's profile control. Voice remains on the right.
- Both light and dark themes follow the root menu. No submenu-specific card gradients.
- Preserve navigation destinations, setup checks, notifications, accessibility labels, and bottom-navigation clearance.
- Shared definitions: `src/design/canonicalMenuLayout.ts` and `src/components/CanonicalMenuTile.tsx`.
