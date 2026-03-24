# Evenly Handoff

## Repo
- Path: `/Users/aryasockalingam/Documents/evenly`
- Current branch: `main`
- Last committed changes on branch: `8d78850 Add fair split calculator and rotations flow`

## Current local work
These changes are local and not committed yet:
- `app/groups/page.js`
- `app/me/page.js`
- `app/page.js`
- `app/people/page.js`
- `components/BottomNav.js`
- `components/CreateGroupModal.js`
- `components/GroupCard.js`
- `components/GroupDetailPage.js`
- `lib/groupData.js`
- `app/activity/page.js` (new)
- `app/settings/page.js` (new)
- `sql/evenly-2-foundation.sql` (new)

## What changed locally
### Evenly 2.0 foundation
- Added onboarding fork for `Trip or event` vs `Roommates or housemates`
- Added mode-aware create flow for trips and groups
- Added trip metadata support in the data layer with schema fallbacks
- Added SQL foundation file for `groups.group_type`, `start_date`, `end_date`, `starts_at`, `ends_at`

### Shell/product flow
- Bottom nav is now `Home / Activity / People / Settings`
- `/groups` is being reshaped into the new Home dashboard while preserving the stacked cards
- `/activity` is a new unified cross-group timeline
- `/settings` is a new settings destination
- `/me` currently redirects to `/settings`
- Groups home now surfaces:
  - net balance hero
  - monthly stats
  - action-needed card
  - your-turn rotations
  - quick create/join actions

## Verification
- `npm run lint` passes
- `npm run build` passes

## Supabase SQL to run
From `sql/evenly-2-foundation.sql`:

```sql
alter table public.groups
add column if not exists group_type text,
add column if not exists start_date date,
add column if not exists end_date date,
add column if not exists starts_at date,
add column if not exists ends_at date;

update public.groups
set group_type = coalesce(group_type, type, 'group')
where group_type is null;
```

## Recommended next step
- Commit the local Evenly 2.0 shell work
- Then continue with the group/trip detail facelift

## Suggested commit message
`Start Evenly 2.0 shell with trip/group onboarding and new app navigation`
