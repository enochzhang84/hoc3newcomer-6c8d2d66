## Church Multi-Screen Digital Signage System

Build a realtime digital signage system under 影音播放 → 屏幕管理, supporting unlimited TV screens with instant content updates via Supabase Realtime.

### 1. Database (new tables)

**`display_screens`** — registry of TVs
- `id` uuid PK
- `slug` text unique (e.g. `tv1`, `tv2`, `lobby-east`)
- `name` text (e.g. "大堂电视 1")
- `location` text (e.g. "Lobby")
- `orientation` text default `'landscape'` (`landscape` | `portrait`)
- `current_content_type` text — one of: `welcome`, `qrcode`, `worship`, `retreat`, `meal`, `announcement`, `emergency`, `playlist`
- `current_content_payload` jsonb — content-type-specific (QR URL, message text, playlist id, etc.)
- `playlist_id` uuid nullable → `display_playlists.id`
- `last_seen_at` timestamptz
- `is_active` boolean default true
- `created_at`, `updated_at`

**`display_playlists`** — named playlists
- `id`, `name`, `interval_seconds` (default 10), `created_at`, `updated_at`

**`display_playlist_items`** — ordered pages
- `id`, `playlist_id` FK, `sort_order`, `content_type`, `content_payload` jsonb

RLS:
- Admins (admin / super_admin) full manage on all three
- Anyone (anon + authenticated) `SELECT` (TV pages render publicly, no login)
- TVs can `UPDATE last_seen_at` on `display_screens` — handled via a public RPC `touch_display_screen(slug text)` to avoid opening UPDATE to anon

GRANTs included per stack rules. Enable realtime publication on all three tables.

### 2. TV display route — `/display/$slug`

Single dynamic route (replaces the need to hand-create tv1–tv5; works for unlimited screens).

- Fetch screen by slug
- Subscribe to Supabase Realtime (postgres_changes on `display_screens` filtered by id, and `display_playlist_items` filtered by playlist_id)
- Render full-screen content based on `current_content_type`:
  - **welcome**: church logo + welcome message
  - **qrcode**: large QR (uses existing QR pattern)
  - **worship**: pulls Sunday worship schedule
  - **retreat**: retreat registration QR + info
  - **meal**: meal notice from `meal_plans`
  - **announcement**: custom text/title
  - **emergency**: red full-screen alert with message
  - **playlist**: rotates through items at `interval_seconds`
- Heartbeat every 20s → calls `touch_display_screen(slug)` RPC to update `last_seen_at`
- Supports landscape & portrait via `orientation` (CSS rotates or stacks layout)
- No chrome/nav — pure full-screen black/yellow themed display

`/display/tv1` … `/display/tv5` work out of the box once those slugs exist (seeded). New screens added via admin UI work immediately at `/display/{slug}`.

### 3. Admin UI — 影音播放 → 屏幕管理 → 多屏管理

Inside the existing `mediaSubTab === "screen"` tab (which currently holds 影音投影), add a sub-section "TV 屏幕管理":

- Grid of screen cards showing:
  - Name + location + slug
  - Online indicator (green if `last_seen_at` within 60s, gray otherwise) + last seen
  - Current content type badge
  - Quick-pick buttons: 欢迎屏 / 二维码 / 主日崇拜 / 退修会 / 用餐通知 / 公告 / 紧急广播 / 播放列表
  - "打开" link → `/display/{slug}` in new tab
  - Edit name/location/orientation, delete
- "+ 新增屏幕" button (slug, name, location, orientation)
- Playlist editor section: create playlist, add/reorder/edit items, set interval
- Emergency Broadcast button: pushes red alert to ALL screens at once
- Announcement input: applies custom message to selected screens

All changes write to DB; TVs receive updates instantly via Realtime.

### 4. Files

New:
- `supabase/migrations/{ts}_display_signage.sql` — tables, GRANTs, RLS, realtime publication, `touch_display_screen` RPC, seed tv1–tv5
- `src/routes/display.$slug.tsx` — public full-screen TV route
- `src/components/admin/ScreenManager.tsx` — admin UI panel

Modified:
- `src/routes/admin.tsx` — mount `<ScreenManager />` inside the `screen` sub-tab (alongside existing 影音投影)

### 5. Responsive / hardware

- TV route uses `100vw × 100vh`, large font scale, no scrollbars
- Portrait orientation: stacks vertically with larger text
- Works on MacBook/Mac Mini browsers, iPad (touch-safe), HDMI-out TVs (no interactivity required on the display page)
- Admin panel responsive (existing tailwind grid pattern)

### Out of scope (can be added later)

- Per-screen scheduling (time-based content rotation)
- Image/video upload for custom announcements (current version uses text + existing data)
- Authentication on TV displays (intentionally public; protected by obscure slug)
