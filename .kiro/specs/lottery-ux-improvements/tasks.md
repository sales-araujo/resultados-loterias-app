# Implementation Plan: Lottery UX Improvements

## Overview

This plan implements UX, performance, and maintainability improvements for the "Loterias Caixa - Meus Jogos" app. Changes are organized to build incrementally: first remove dead code (push system), then improve infrastructure (cache), add utility functions, create new components, and finally refactor the main page to wire everything together. Property-based tests validate correctness properties from the design using `fast-check`.

## Tasks

- [x] 1. Remove push notification system and debug route
  - [x] 1.1 Delete push notification files and remove dependencies
    - Delete `hooks/usePushNotifications.ts`
    - Delete `app/api/push/subscribe/route.ts` and `app/api/push/notify/route.ts` (and their directories `app/api/push/`)
    - Delete `public/sw-push.js`
    - Delete `app/api/debug/route.ts` (and directory `app/api/debug/`)
    - Remove `web-push` from `dependencies` in `package.json`
    - Remove `@types/web-push` from `devDependencies` in `package.json`
    - Remove cron jobs from `vercel.json` (the `crons` array referencing `/api/push/notify`)
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 5.7, 7.5_
  - [x] 1.2 Remove push notification references from page.tsx and layout
    - Remove `import { usePushNotifications }` and all usage from `app/page.tsx`
    - Remove the notification bell button (Bell/BellOff/BellRing icons) from the header in `app/page.tsx`
    - Remove deep link logic (`?game=...&contest=...` query parameter handling, `deepLinkHandled` state) from `app/page.tsx`
    - Remove unused imports (`Bell`, `BellOff`, `BellRing`) from `app/page.tsx`
    - _Requirements: 5.4, 5.8, 5.9_

- [x] 2. Checkpoint — Verify push removal compiles cleanly
  - Run `next build` or TypeScript check to ensure no broken references remain after push system removal.
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Improve server-side and client-side cache
  - [x] 3.1 Make server-side cache permanent for valid results
    - Modify `app/api/lottery/[game]/[contest]/route.ts`:
      - For successful results (`data !== null`): remove TTL check entirely (cache permanently)
      - For not-found results (`notFound === true`): keep TTL at 60 seconds
      - For error results (`error !== null`): keep TTL at 30 seconds
    - Remove the `CACHE_TTL_MS` constant (5 min) since valid results no longer expire
    - Keep `NOT_FOUND_CACHE_TTL_MS` (60s) and `ERROR_CACHE_TTL_MS` (30s)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 3.2 Make client-side cache use infinite staleTime
    - Modify `hooks/useLotteryResult.ts`:
      - Change `staleTime` to `Infinity`
      - Change `gcTime` to `24 * 60 * 60 * 1000` (24 hours)
    - _Requirements: 1.5_

- [x] 4. Add utility functions for game classification and batch search
  - [x] 4.1 Implement `classifyGame` and `getLatestContestForGame` in `lib/lottery-utils.ts`
    - `getLatestContestForGame(game)`: returns `concurso_fim` if defined, otherwise `concurso_inicio`
    - `classifyGame(game, latestContest)`: returns `"active"` if `getLatestContestForGame(game) >= latestContest`, else `"ended"`
    - _Requirements: 4.1_
  - [ ]* 4.2 Write property test for game classification (Property 3)
    - **Property 3: Game classification correctness**
    - Test with `fast-check`: for any game with arbitrary `concurso_inicio`, optional `concurso_fim`, and any positive `latestContest`, `classifyGame` returns `"active"` iff `getLatestContestForGame(game) >= latestContest`
    - File: `__tests__/game-classification.property.test.ts`
    - **Validates: Requirements 4.1**
  - [x] 4.3 Implement `fetchLotteryResultsBatch` in `lib/lottery-api.ts`
    - Implement inline concurrency limiter (no new dependency) with default limit of 5
    - Accept `BatchSearchOptions` interface: `game`, `startContest`, `endContest`, `concurrency`, `onProgress`, `onResult`, `maxConsecutiveErrors`
    - Return `BatchSearchResult`: `results` Map, `mostRecentContest`, `totalChecked`, `stoppedEarly`
    - Track consecutive errors and stop early after `maxConsecutiveErrors` (default 3)
    - Call `onProgress(checked, total)` after each request completes
    - Call `onResult(contest, result)` for each successful fetch
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ]* 4.4 Write property test for batch search concurrency limit (Property 4)
    - **Property 4: Batch search concurrency limit**
    - Test with `fast-check`: for any range where `end - start >= 5`, mock fetch to track in-flight count, assert never exceeds 5
    - File: `__tests__/batch-search.property.test.ts`
    - **Validates: Requirements 6.1**
  - [ ]* 4.5 Write property test for batch search progress reporting (Property 5)
    - **Property 5: Batch search progress reporting**
    - Test with `fast-check`: for any range, `onProgress` is called with monotonically increasing `checked`, `total` equals range size, final `checked` equals total checked
    - File: `__tests__/batch-search.property.test.ts`
    - **Validates: Requirements 6.2**
  - [ ]* 4.6 Write property test for batch search early stop (Property 6)
    - **Property 6: Batch search early stop on consecutive errors**
    - Test with `fast-check`: for any sequence with 3 consecutive errors, batch search stops with `stoppedEarly: true` and results contain only successful fetches
    - File: `__tests__/batch-search.property.test.ts`
    - **Validates: Requirements 6.4**

- [x] 5. Checkpoint — Verify utility functions and property tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Create new UI components
  - [x] 6.1 Create `components/lottery/ContestSearch.tsx`
    - Numeric input field for direct contest search
    - Props: `currentContest`, `minContest`, `maxContest`, `onSearch`, `disabled`
    - Display current contest as placeholder/default value
    - Validate input: reject non-numeric, empty, out-of-range values
    - Show toast error when contest is out of range
    - Submit on Enter key press
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [ ]* 6.2 Write property test for contest search validation (Property 1)
    - **Property 1: Contest search validation**
    - Test with `fast-check`: for any game range and any integer `n`, the validation logic accepts `n` iff it's within the valid range
    - File: `__tests__/contest-search.property.test.ts`
    - **Validates: Requirements 3.2, 3.3**
  - [ ]* 6.3 Write property test for non-numeric input rejection (Property 2)
    - **Property 2: Non-numeric input rejection**
    - Test with `fast-check`: for any string that is empty or contains non-numeric characters, the validation logic rejects it and current contest remains unchanged
    - File: `__tests__/contest-search.property.test.ts`
    - **Validates: Requirements 3.4**
  - [x] 6.4 Create `components/lottery/GameSection.tsx`
    - Renders a section with title, game count badge, and list of GameCards
    - Props: `title`, `count`, `games`, `config`, `variant` ("active" | "ended"), `onDelete`, `onSearch`, `onUpdateContest`, `isDeleting`
    - When `variant === "ended"`, render cards with `opacity-50` and `grayscale` CSS filter
    - Show empty state message when no games in section
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 7.1_
  - [x] 6.5 Create `components/lottery/GameCardSkeleton.tsx`
    - Skeleton loading placeholder matching GameCard dimensions
    - Use Tailwind `animate-pulse` with appropriate placeholder shapes for numbers, badge, and buttons
    - _Requirements: 7.4_
  - [x] 6.6 Update `components/lottery/GameCard.tsx` for ended style support
    - Add optional `ended` prop to GameCard
    - When `ended === true`, apply `opacity-50 grayscale` wrapper classes
    - _Requirements: 4.4_

- [x] 7. Refactor main page (`app/page.tsx`)
  - [x] 7.1 Replace inline game list with GameSection components
    - Classify games into active and ended using `classifyGame` utility
    - Render `GameSection` for active games with title "Jogos Ativos"
    - Render `GameSection` for ended games with title "Jogos Encerrados" (only when ended games exist)
    - Remove the old carousel-based game list
    - Track `latestContest` per lottery type from fetched results
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 7.1_
  - [x] 7.2 Add ContestSearch to the contest navigator
    - Integrate `ContestSearch` component into the contest navigation bar
    - Display the full range of the game (e.g., "3665 - 3682") alongside the current contest number
    - _Requirements: 3.1, 3.5, 7.3_
  - [x] 7.3 Replace batch search logic with `fetchLotteryResultsBatch`
    - Replace the inline `handleSearchAllContests` function with a call to `fetchLotteryResultsBatch`
    - Populate React Query cache via `onResult` callback using `queryClient.setQueryData`
    - Show progress toast with `onProgress` callback
    - Handle `stoppedEarly` flag in result summary
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x] 7.4 Add skeleton loading states
    - Replace the generic `Loader2` spinner for games loading with `GameCardSkeleton` components
    - Show 2-3 skeleton cards while games are loading from Supabase
    - _Requirements: 7.4_
  - [x] 7.5 Add smooth transitions for contest navigation
    - Ensure `AnimatePresence` with `framer-motion` wraps result transitions when navigating between contests
    - Apply slide/fade animation when switching contest results
    - _Requirements: 7.2_

- [x] 8. Checkpoint — Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Final build verification
  - [x] 9.1 Run TypeScript compilation and Next.js build
    - Run `npx next build` to verify the entire app compiles without errors
    - Verify no TypeScript errors related to removed push system references
    - Verify no missing imports or broken references
    - _Requirements: 5.9_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using `fast-check`
- Unit tests validate specific examples and edge cases
- The implementation language is TypeScript (matching the existing Next.js project)
- All 6 correctness properties from the design document are covered by property test tasks (4.2, 4.4, 4.5, 4.6, 6.2, 6.3)
