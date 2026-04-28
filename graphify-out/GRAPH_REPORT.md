# Graph Report - .  (2026-04-28)

## Corpus Check
- 73 files · ~122,196 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 353 nodes · 411 edges · 57 communities detected
- Extraction: 58% EXTRACTED · 42% INFERRED · 1% AMBIGUOUS · INFERRED: 171 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_API Routes|API Routes]]
- [[_COMMUNITY_Noor App State|Noor App State]]
- [[_COMMUNITY_Client API Services|Client API Services]]
- [[_COMMUNITY_Architecture Rationale|Architecture Rationale]]
- [[_COMMUNITY_Chat Service Functions|Chat Service Functions]]
- [[_COMMUNITY_Build Tooling|Build Tooling]]
- [[_COMMUNITY_Backend Chat Flows|Backend Chat Flows]]
- [[_COMMUNITY_Tutor Brand Assets|Tutor Brand Assets]]
- [[_COMMUNITY_Brand Identity|Brand Identity]]
- [[_COMMUNITY_Auth Session Context|Auth Session Context]]
- [[_COMMUNITY_Scholar Full Portrait|Scholar Full Portrait]]
- [[_COMMUNITY_Scholar Avatar Image|Scholar Avatar Image]]
- [[_COMMUNITY_Error Avatar UI|Error Avatar UI]]
- [[_COMMUNITY_Mentorship Persona|Mentorship Persona]]
- [[_COMMUNITY_Theme Not Found|Theme Not Found]]
- [[_COMMUNITY_Serve Script|Serve Script]]
- [[_COMMUNITY_Error Boundary|Error Boundary]]
- [[_COMMUNITY_Prayer Times Hook|Prayer Times Hook]]
- [[_COMMUNITY_Prayer Quiz Content|Prayer Quiz Content]]
- [[_COMMUNITY_Sect Context|Sect Context]]
- [[_COMMUNITY_Feature Flags|Feature Flags]]
- [[_COMMUNITY_Model Context|Model Context]]
- [[_COMMUNITY_Madhhab Context|Madhhab Context]]
- [[_COMMUNITY_Teacher Context|Teacher Context]]
- [[_COMMUNITY_History Formatting|History Formatting]]
- [[_COMMUNITY_Error Fallback|Error Fallback]]
- [[_COMMUNITY_AI Model Selection|AI Model Selection]]
- [[_COMMUNITY_Public Quran Cache|Public Quran Cache]]
- [[_COMMUNITY_Guardian Screen|Guardian Screen]]
- [[_COMMUNITY_Profile Logout|Profile Logout]]
- [[_COMMUNITY_Quiz Screen|Quiz Screen]]
- [[_COMMUNITY_Lesson Screen|Lesson Screen]]
- [[_COMMUNITY_Login Screen|Login Screen]]
- [[_COMMUNITY_Signup Screen|Signup Screen]]
- [[_COMMUNITY_Auth Layout|Auth Layout]]
- [[_COMMUNITY_Keyboard Aware Scroll|Keyboard Aware Scroll]]
- [[_COMMUNITY_Teacher Registry|Teacher Registry]]
- [[_COMMUNITY_Revelation Ordering|Revelation Ordering]]
- [[_COMMUNITY_Grok Test Script|Grok Test Script]]
- [[_COMMUNITY_Expo Types|Expo Types]]
- [[_COMMUNITY_Metro Config|Metro Config]]
- [[_COMMUNITY_Babel Config|Babel Config]]
- [[_COMMUNITY_App Layout File|App Layout File]]
- [[_COMMUNITY_Call Noor Screen|Call Noor Screen]]
- [[_COMMUNITY_Mode Select Screen|Mode Select Screen]]
- [[_COMMUNITY_Home Redirect|Home Redirect]]
- [[_COMMUNITY_Root Layout File|Root Layout File]]
- [[_COMMUNITY_Color Tokens|Color Tokens]]
- [[_COMMUNITY_Scholar Avatar Component|Scholar Avatar Component]]
- [[_COMMUNITY_Voice Recorder|Voice Recorder]]
- [[_COMMUNITY_Surah Picker|Surah Picker]]
- [[_COMMUNITY_Quran Data|Quran Data]]
- [[_COMMUNITY_Next Types|Next Types]]
- [[_COMMUNITY_Next Config|Next Config]]
- [[_COMMUNITY_Web Layout|Web Layout]]
- [[_COMMUNITY_Web Page|Web Page]]
- [[_COMMUNITY_Auth Layout Component|Auth Layout Component]]

## God Nodes (most connected - your core abstractions)
1. `POST()` - 18 edges
2. `main()` - 12 edges
3. `GET()` - 10 edges
4. `apiUrl()` - 8 edges
5. `Molana Full Image` - 7 edges
6. `streamSsePost()` - 6 edges
7. `completion()` - 6 edges
8. `Quran AI chat streaming service` - 6 edges
9. `Noor Ai` - 6 edges
10. `Guiding Intelligence. Empowering Humanity.` - 6 edges

## Surprising Connections (you probably didn't know these)
- `API CORS Headers` --implements--> `Quran AI Tutor Architecture`  [INFERRED]
  apps/web/next.config.ts → README.md
- `Feature Config Context` --conceptually_related_to--> `Quran AI Tutor Architecture`  [INFERRED]
  artifacts/quran-ai-tutor/contexts/FeatureConfigContext.tsx → README.md
- `Metro Monorepo Resolution` --implements--> `Quran AI Tutor Architecture`  [INFERRED]
  artifacts/quran-ai-tutor/metro.config.js → README.md
- `Health Liveness Route` --conceptually_related_to--> `Quran AI Tutor Architecture`  [INFERRED]
  apps/web/app/api/health/route.ts → README.md
- `Request JWT Validation` --implements--> `Bearer JWT API Pattern`  [EXTRACTED]
  apps/web/lib/supabase/auth.ts → README.md

## Hyperedges (group relationships)
- **Authenticated RLS Route Pattern** — auth_request_jwt_validation, auth_user_scoped_client_for_request, server_supabase_user_client, sessions_collection_route, profile_route [EXTRACTED 1.00]
- **AI Chat Prompt Provider Flow** — chat_sse_route, providers_provider_routing, providers_completion_helpers, prompts_centralized_prompt_builders, prompts_sect_madhhab_clause [EXTRACTED 1.00]
- **Quran Content Fetch Cache Pattern** — surahs_public_cached_route, ayah_public_cached_route, quran_external_alquran_api [EXTRACTED 1.00]
- **personalized AI answer flow** — chunk02:context:model, chunk02:context:sect, chunk02:context:madhhab, chunk02:context:teacher, chunk02:feature:personalization-context, chunk02:screen:guardian, chunk02:screen:lesson-tab, chunk02:screen:call-noor, chunk02:service:ai-chat [INFERRED 1.00]
- **lesson session lifecycle** — chunk02:screen:lesson-tab, chunk02:context:sessions, chunk02:concept:offline-first-sync, chunk02:screen:quiz, chunk02:screen:history-tab, chunk02:store:async-storage, chunk02:backend:api-fetch [INFERRED 1.00]
- **authenticated navigation surface** — chunk02:context:auth, chunk02:screen:index-redirect, chunk02:screen:auth-login, chunk02:screen:auth-signup, chunk02:screen:mode-select, chunk02:navigation:tabs, chunk02:screen:profile [INFERRED 1.00]
- **Personalized Quran learning experience** — chunk03_static_quran_learning_content, chunk03_quiz_question_bank, chunk03_teacher_persona_catalog, chunk03_ai_provider_catalog, chunk03_ai_chat_streaming_service, chunk03_scholar_avatar_state_machine [INFERRED 0.70]
- **Authenticated backend interaction pattern** — chunk03_supabase_session_auth, chunk03_access_token_provider, chunk03_api_url_resolution, chunk03_transcription_endpoint, chunk03_ai_chat_streaming_service, chunk03_authenticated_api_fetch [EXTRACTED 1.00]
- **Expo Go static deployment flow** — chunk03_static_expo_build_pipeline, chunk03_metro_bundle_generation, chunk03_static_asset_rewriting, chunk03_expo_go_landing_page, chunk03_qr_deeplink_bootstrap [INFERRED 0.73]
- **hyperedge:noor-ai-brand-system** — brand:noor-ai, text:guiding-intelligence-empowering-humanity, palette:gold-and-turquoise, visual:gold-human-profile, visual:turquoise-circuit-brain, visual:radiant-light-starburst [INFERRED 1.00]
- **hyperedge:faith-and-ai-synthesis** — concept:spiritual-guidance, concept:ai-intelligence, visual:islamic-geometric-border, visual:gold-human-profile, visual:turquoise-circuit-brain, app:quran-ai-tutor [INFERRED 0.74]
- **Noor Ai brand identity** — brand:noor_ai, text:noor_ai_wordmark, text:guiding_intelligence_empowering_humanity, visual:split_head_brain_icon [INFERRED 1.00]
- **Human and artificial intelligence synthesis** — visual:split_head_brain_icon, concept:human_intelligence, concept:artificial_intelligence, visual:neural_circuit_pattern, palette:gold_and_cyan [INFERRED 0.84]
- **Islamic visual language for AI guidance** — project:quran_ai_tutor, visual:islamic_geometric_ornament, visual:radiant_crown_starburst, concept:guidance, concept:empowerment [INFERRED 0.76]
- **Scholarly Guidance Composition** — molana_avatar_elderly_islamic_scholar, molana_avatar_library_study_setting, molana_avatar_warm_window_light, molana_avatar_students_or_listeners, molana_avatar_trustworthy_religious_guidance [INFERRED 0.80]
- **Scholarly Instruction Scene** — molana_full_elderly_islamic_scholar, molana_full_children_gathered_around, molana_full_teaching_gesture, molana_full_library_setting, molana_full_patterned_rug_floor_seating [INFERRED 0.82]
- **Warm Trustworthy Guidance Atmosphere** — molana_full_elderly_islamic_scholar, molana_full_white_turban_and_robe, molana_full_arched_window_light, molana_full_library_setting, molana_full_noor_tutor_persona [INFERRED 0.76]
- **hyperedge:teacher_students_learning_scene** — entity:elderly_religious_teacher, entity:children_students, setting:warm_study_or_madrasa, concept:islamic_instruction [INFERRED 0.80]
- **hyperedge:tutor_persona_design_language** — visual_style:warm_reverent_portrait, concept:mentorship_and_guidance, design_intent:trustworthy_quran_tutor_persona [INFERRED 0.76]
- **hyperedge:splash-brand-composition** — brand:noor-ai, text:guiding-intelligence-empowering-humanity, visual:split-human-ai-head, palette:gold-turquoise-cream, visual:radiant-starburst [INFERRED 1.00]
- **hyperedge:islamic-ai-guidance-positioning** — app:quran-ai-tutor, concept:islamic-ai-tutoring, concept:human-guidance, concept:artificial-intelligence, visual:islamic-geometric-frame, visual:turquoise-circuit-brain [INFERRED 0.76]

## Communities

### Community 0 - "API Routes"
Cohesion: 0.09
Nodes (22): authErrorResponse(), authFromRequest(), clientForRequest(), buildAyahContext(), buildGuardianSystemPrompt(), buildLessonSystemPrompt(), normaliseSect(), sectClause() (+14 more)

### Community 1 - "Noor App State"
Cohesion: 0.08
Nodes (34): Noor AI Quran tutor app, backend API via apiFetch, KeyboardAwareScrollViewCompat, Call Noor turn state machine, offline-first session sync, AuthProvider, MadhhabProvider, ModelProvider (+26 more)

### Community 2 - "Client API Services"
Cohesion: 0.1
Nodes (24): Current access token provider, Quran AI chat streaming service, AI provider and model catalog, Backend API URL resolution, Authenticated API fetch wrapper, Client-side Quran prompt templates, Default OpenAI GPT-4.1 model choice, Expo Go landing page template (+16 more)

### Community 3 - "Architecture Rationale"
Cohesion: 0.1
Nodes (22): Bearer JWT API Pattern, Next.js and Supabase Replacement Rationale, Quran AI Tutor Architecture, User-Scoped Supabase RLS Isolation, Request JWT Validation, Client For Request, Expo Babel Import Meta Transform, Persisted Feature Flags In AsyncStorage (+14 more)

### Community 4 - "Chat Service Functions"
Cohesion: 0.15
Nodes (13): generateSummary(), getQuizExplanation(), readSseStream(), streamChat(), streamGuardianChat(), streamSsePost(), apiFetch(), apiUrl() (+5 more)

### Community 5 - "Build Tooling"
Cohesion: 0.19
Nodes (18): checkMetroHealth(), clearMetroCache(), downloadAssets(), downloadBundle(), downloadBundlesAndManifests(), downloadFile(), downloadManifest(), exitWithError() (+10 more)

### Community 6 - "Backend Chat Flows"
Cohesion: 0.12
Nodes (20): SSE Streaming Chat, Whisper Uses OpenAI Regardless Of Chat Provider, Guardian Chat Mode, Lesson Chat Mode, Quran Chat SSE Route, Quiz Answer Explanation Route, Audio Upload Body Size Limit, Ayah Context Builder (+12 more)

### Community 7 - "Tutor Brand Assets"
Cohesion: 0.19
Nodes (17): quran-ai-tutor, Noor Ai, AI intelligence, artificial intelligence, human guidance, Islamic AI tutoring, spiritual guidance, gold and turquoise palette (+9 more)

### Community 8 - "Brand Identity"
Cohesion: 0.2
Nodes (14): Noor Ai, Artificial intelligence, Empowerment, Guidance, Human intelligence, logo.png, Gold and cyan color palette, Quran AI Tutor (+6 more)

### Community 9 - "Auth Session Context"
Cohesion: 0.18
Nodes (4): fetchProfile(), useAuth(), IndexRedirect(), SessionProvider()

### Community 10 - "Scholar Full Portrait"
Cohesion: 0.24
Nodes (11): Arched Window Light, Children Gathered Around, Elderly Islamic Scholar, Molana Full Image, Library Setting, Noor Tutor Persona, Patterned Rug Floor Seating, Rationale for Scholarly Guidance Avatar (+3 more)

### Community 11 - "Scholar Avatar Image"
Cohesion: 0.31
Nodes (9): Elderly Islamic Scholar, Molana Avatar Image, Library or Study Setting, Noor Tutor Persona, Rationale for Scholar Avatar, Students or Listeners, Trustworthy Religious Guidance, Warm Window Light (+1 more)

### Community 12 - "Error Avatar UI"
Cohesion: 0.29
Nodes (8): Developer-only error details modal, Error boundary recovery flow, ErrorFallback recovery UI, Noor teacher-present avatar design intent, ScholarAvatar state-driven animations, Resolved theme color tokens, TTS boundary pulse helper, TTS language detection

### Community 13 - "Mentorship Persona"
Cohesion: 0.36
Nodes (8): Islamic instruction, Mentorship and guidance, Trustworthy Quran tutor persona, Children students, Elderly religious teacher, molana-portrait.jpg, Warm study or madrasa setting, Warm reverent portrait style

### Community 14 - "Theme Not Found"
Cohesion: 0.29
Nodes (3): NotFoundScreen(), useTheme(), useColors()

### Community 15 - "Serve Script"
Cohesion: 0.4
Nodes (0): 

### Community 16 - "Error Boundary"
Cohesion: 0.4
Nodes (1): ErrorBoundary

### Community 17 - "Prayer Times Hook"
Cohesion: 0.4
Nodes (0): 

### Community 18 - "Prayer Quiz Content"
Cohesion: 0.4
Nodes (5): Aladhan prayer timings service, Six-hour prayer times cache, Prayer times hook, Quran quiz question bank, Static Quran learning content

### Community 19 - "Sect Context"
Cohesion: 0.5
Nodes (0): 

### Community 20 - "Feature Flags"
Cohesion: 0.67
Nodes (0): 

### Community 21 - "Model Context"
Cohesion: 0.67
Nodes (0): 

### Community 22 - "Madhhab Context"
Cohesion: 0.67
Nodes (0): 

### Community 23 - "Teacher Context"
Cohesion: 0.67
Nodes (0): 

### Community 24 - "History Formatting"
Cohesion: 1.0
Nodes (2): formatDate(), formatTime()

### Community 25 - "Error Fallback"
Cohesion: 0.67
Nodes (0): 

### Community 26 - "AI Model Selection"
Cohesion: 1.0
Nodes (2): getModel(), getProvider()

### Community 27 - "Public Quran Cache"
Cohesion: 1.0
Nodes (3): Public Cached Ayah Route, AlQuran Cloud API, Public Cached Surah List Route

### Community 28 - "Guardian Screen"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Profile Logout"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Quiz Screen"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Lesson Screen"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Login Screen"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Signup Screen"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Auth Layout"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Keyboard Aware Scroll"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Teacher Registry"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Revelation Ordering"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Grok Test Script"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Expo Types"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Metro Config"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Babel Config"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "App Layout File"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Call Noor Screen"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Mode Select Screen"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Home Redirect"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Root Layout File"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Color Tokens"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Scholar Avatar Component"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Voice Recorder"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Surah Picker"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Quran Data"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Next Types"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Next Config"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Web Layout"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Web Page"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Auth Layout Component"
Cohesion: 1.0
Nodes (1): AuthLayout

## Ambiguous Edges - Review These
- `Metro bundle generation and health checks` → `QR and deep-link bootstrap`  [AMBIGUOUS]
  artifacts/quran-ai-tutor/server/templates/landing-page.html · relation: depends_on_generated_exps_url_placeholders_being_filled
- `Elderly Islamic Scholar` → `Students or Listeners`  [AMBIGUOUS]
  artifacts/quran-ai-tutor/assets/images/noor/molana-avatar.jpg · relation: conceptually_related_to
- `Children Gathered Around` → `Traditional Quranic Instruction`  [AMBIGUOUS]
  artifacts/quran-ai-tutor/assets/images/noor/molana-full.jpg · relation: conceptually_related_to

## Knowledge Gaps
- **36 isolated node(s):** `SSE Streaming Chat`, `Next.js and Supabase Replacement Rationale`, `Default Models Per Provider`, `Centralized Prompt Builders`, `Ayah Context Builder` (+31 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Guardian Screen`** (2 nodes): `guardian.tsx`, `formatTime()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Profile Logout`** (2 nodes): `profile.tsx`, `handleLogout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Quiz Screen`** (2 nodes): `quiz.tsx`, `handleAnswer()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Lesson Screen`** (2 nodes): `lesson.tsx`, `formatTime()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Login Screen`** (2 nodes): `login.tsx`, `handleLogin()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Signup Screen`** (2 nodes): `signup.tsx`, `handleSignup()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Layout`** (2 nodes): `_layout.tsx`, `AuthLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Keyboard Aware Scroll`** (2 nodes): `KeyboardAwareScrollViewCompat.tsx`, `KeyboardAwareScrollViewCompat()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Teacher Registry`** (2 nodes): `teachers.ts`, `getTeacherById()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Revelation Ordering`** (2 nodes): `revelationOrder.ts`, `sortByRevelation()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Grok Test Script`** (2 nodes): `test-grok.js`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Expo Types`** (1 nodes): `expo-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Metro Config`** (1 nodes): `metro.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Babel Config`** (1 nodes): `babel.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Layout File`** (1 nodes): `_layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Call Noor Screen`** (1 nodes): `call-noor.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Mode Select Screen`** (1 nodes): `mode-select.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Home Redirect`** (1 nodes): `index.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Root Layout File`** (1 nodes): `_layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Color Tokens`** (1 nodes): `colors.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Scholar Avatar Component`** (1 nodes): `ScholarAvatar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Voice Recorder`** (1 nodes): `VoiceRecorder.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Surah Picker`** (1 nodes): `SurahPickerModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Quran Data`** (1 nodes): `quran.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next Types`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next Config`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Web Layout`** (1 nodes): `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Web Page`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Layout Component`** (1 nodes): `AuthLayout`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Metro bundle generation and health checks` and `QR and deep-link bootstrap`?**
  _Edge tagged AMBIGUOUS (relation: depends_on_generated_exps_url_placeholders_being_filled) - confidence is low._
- **What is the exact relationship between `Elderly Islamic Scholar` and `Students or Listeners`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Children Gathered Around` and `Traditional Quranic Instruction`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Session Summary Route` connect `Backend Chat Flows` to `Architecture Rationale`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `POST()` (e.g. with `authFromRequest()` and `authErrorResponse()`) actually correct?**
  _`POST()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `GET()` (e.g. with `POST()` and `authFromRequest()`) actually correct?**
  _`GET()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `apiUrl()` (e.g. with `fetchSurahList()` and `fetchAyah()`) actually correct?**
  _`apiUrl()` has 5 INFERRED edges - model-reasoned connections that need verification._