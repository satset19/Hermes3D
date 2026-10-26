# Graph Report - hermes3d  (2026-10-26)

## Corpus Check
- 628 files · ~503,829 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 36 file(s) not represented in the graph (top: .glb 25, (none) 6, .css 2)

## Summary
- 5680 nodes · 13933 edges · 208 communities (195 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 194 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `346715e8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- palette.ts
- furnitureDefaults.ts
- RetroOffice3D.tsx
- isRecord
- useAgentSettingsMutationController.ts
- navigation.ts
- OfficeScreen.tsx
- react
- presentation.ts
- presence.ts
- constants.ts
- gatewayRuntimeEventHandler.ts
- GatewayClient
- pixel-office/types.ts
- settings.ts
- furniture.ts
- loadStudioSettings
- GatewayBrowserClient.ts
- spotify-jukebox/store.ts
- AgentChatPanel.tsx
- hermes3doctor.mjs
- AgentState
- skills/types.ts
- custom/provider.ts
- runtimeEventBridge.ts
- agentConfig.ts
- fillRect
- useChatInteractionController.ts
- eventTriggers.ts
- resolveStateDir
- AgentsPageScreen.tsx
- QA Department Spec
- QA Department Spec
- execApprovalRuntimeCoordinator.ts
- AgentCreateWizardModal.tsx
- __init__.py
- GatewayClient.ts
- agentMessaging.ts
- coordinator.ts
- Agent State Model Spec
- mutationLifecycleWorkflow.ts
- conversations.ts
- Desk Progression Spec
- Desk Progression Spec
- colorSemantics.ts
- EventFrame
- deskDirectives.ts
- Office Systems Roadmap
- planning.ts
- visualSystems.tsx
- office/store.ts
- Bulletin Board Spec
- Bulletin Board Spec
- Whiteboard Spec
- Whiteboard Spec
- shared-store.ts
- useUsageAnalytics.ts
- Meeting Room Workflow Spec
- Meeting Room Workflow Spec
- chatItems.ts
- models.ts
- useTaskBoardController.ts
- pathfinding.ts
- Hierarchy And Teams Spec
- Hierarchy And Teams Spec
- message-extract.ts
- vitest
- with
- browser-preview/route.ts
- runtimeChatEventWorkflow.ts
- useOfficeSkillTriggers.ts
- atmosphere.tsx
- schema.ts
- agentPermissionsOperation.ts
- OfficePhaserCanvas.tsx
- StudioSettingsCoordinator
- profile.ts
- presence.ts
- environment.tsx
- Multi-Agent Beta
- next
- standup/store.ts
- store.tsx
- TaskBoardView.tsx
- Hermes3Doctor Spec
- lucide-react
- settings-store.ts
- execApprovalControlLoopWorkflow.ts
- personalityBuilder.ts
- createPayloadBuilder.ts
- Runtime Profile Architecture
- bridge.js
- AgentAvatarGlbModel.tsx
- agentFleetHydrationDerivation.ts
- Office Systems Roadmap
- call/mock.ts
- agents.tsx
- settingsRouteWorkflow.ts
- [0.1.4] - 2026-04-23
- service.ts
- SmsBoothImmersiveScreen.tsx
- GithubImmersiveScreen.tsx
- mergeStudioSettings
- Hermes3D + Hermes + Tailscale Setup Tutorial
- Hermes3D — A 3D Workspace for AI Agents
- demo-gateway-adapter.js
- createDefaultAgentAvatarProfile
- Custom Runtime Provider Spec
- dependencies
- devDependencies
- hermes-gateway-adapter.js
- tasks/types.ts
- standup/types.ts
- Architecture
- README.md
- package.json
- randomUUID
- github.ts
- Custom Provider Reference
- handleMethod
- layout/route.ts
- .connect
- Code Documentation
- components.json
- index.js
- chatSendOperation.ts
- makeGrid
- LightingSystem
- compilerOptions
- Skills in Hermes3D
- deskMonitor.ts
- useConfigMutationQueue.ts
- runtimeAgentEventWorkflow.test.ts
- upstreamUrlDiagnostics.ts
- normalizeCommandText
- specialLatestUpdateOperation.ts
- AgentsPageScreen.tsx
- custom/route.ts
- buildAgentMainSessionKey
- HermesAgentJsonRpcClient
- ref_node_path
- studioRoute.ts
- path-suggestions/route.ts
- createAgentBootstrapOperation.ts
- Hermes Gateway Adapter
- kanban.js
- github/route.ts
- scripts
- gateway-proxy.js
- cleanup-ux-artifacts.mjs
- useOnboardingState.ts
- Creating Skills
- PI + Chat Streaming (Studio Side)
- eslint.config.mjs
- useOfficeStandupController.ts
- gateway.ts
- navigation.diagonalCorner.test.ts
- Runtime Profiles
- AgentAvatarProfile
- useOfficeBuilderStore.ts
- Universal Backend Plan
- Critical Fixes
- @testing-library/jest-dom
- voiceReply/provider.ts
- shared-store-client.ts
- Hermes3D Vision
- agentSettingsMutationWorkflow.ts
- Task Manager
- TODO Board
- Connect Hermes3D to a remote hermes-agent over Tailscale
- Agent Bus Integration
- sanitizeErrorMessage
- multiavatar.ts
- transcription.ts
- Contributing
- agent
- Roadmap
- hermes3d-start.sh
- office-speech.js
- network-policy.js
- gatewayClient.reconnect-recovery.test.ts
- Development environment instructions
- Gateway Skill Contract
- Showing outside conversations in the office
- SceneErrorBoundary
- plugin.yaml
- deploy-local.sh
- completeOneTurn
- officeSpeech.ts
- GatewayConnectScreen.tsx
- 9) Troubleshooting
- Quick Start
- High-Value PR Split
- contact_links
- Security Policy
- useStudioVoiceRepliesPreference.ts
- Gateway: Sandbox Semantics
- smoke-dev-server.mjs
- ws-probe.js
- WebSocket Frame Shapes
- install.sh
- multiavatar
- .github/SECURITY.md
- postcss.config.mjs
- verify-hermes3d.sh

## God Nodes (most connected - your core abstractions)
1. `vitest` - 191 edges
2. `react` - 121 edges
3. `OfficeScreen()` - 114 edges
4. `AgentState` - 99 edges
5. `GatewayClient` - 79 edges
6. `fillRect()` - 71 edges
7. `AgentsPageScreen()` - 67 edges
8. `toWorld()` - 67 edges
9. `RetroOffice3D()` - 66 edges
10. `setPx()` - 61 edges

## Surprising Connections (you probably didn't know these)
- `History Sync (Recovery, Load More)` --references--> `buildHistoryLines()`  [INFERRED]
  docs/pi-chat-streaming.md → src/features/agents/state/runtimeEventBridge.ts
- `Current Post-Merge Sequence` --references--> `OfficeScreen()`  [INFERRED]
  docs/office_sys/office-systems-roadmap.md → src/features/office/screens/OfficeScreen.tsx
- `Immediate Next Deliverables` --references--> `OfficeScreen()`  [INFERRED]
  docs/office_sys/office-systems-roadmap.md → src/features/office/screens/OfficeScreen.tsx
- `Platform Prerequisites` --references--> `OfficeScreen()`  [INFERRED]
  docs/office_sys/office-systems-roadmap.md → src/features/office/screens/OfficeScreen.tsx
- `Main Runtime Flow` --references--> `GatewayClient`  [INFERRED]
  CODE_DOCUMENTATION.md → src/lib/gateway/GatewayClient.ts

## Import Cycles
- None detected.

## Communities (208 total, 13 thin omitted)

### Community 0 - "palette.ts"
Cohesion: 0.03
Nodes (104): ACCENT_AMBER, ACCENT_BLUE, ACCENT_BLUE_DARK, ACCENT_MAGENTA, ACCENT_PURPLE, ACCENT_RED, ACCENT_RED_DARK, ACCENT_TEAL (+96 more)

### Community 1 - "furnitureDefaults.ts"
Cohesion: 0.07
Nodes (54): BEDROOM_SIGNATURES, createFurnitureSignature(), DEFAULT_ART_ROOM_ITEMS, DEFAULT_ATM_MACHINE, DEFAULT_DINING_ITEMS, DEFAULT_FURNITURE, DEFAULT_GYM_ITEMS, DEFAULT_JUKEBOX (+46 more)

### Community 2 - "RetroOffice3D.tsx"
Cohesion: 0.03
Nodes (104): @react-three/fiber, Bubble(), PhoneBoothImmersiveScreen(), PhoneCallStep, BUMP_FREEZE_MS, PING_PONG_BALL_RADIUS, PING_PONG_TABLE_SURFACE_Y, SEPARATION_STRENGTH (+96 more)

### Community 3 - "isRecord"
Cohesion: 0.10
Nodes (52): coerceString(), defaultFocusedPreference(), defaultStudioStandupManualEntry(), isRecord(), mergeGatewayConnectionState(), mergeGatewayProfiles(), mergeGatewaySettings(), mergeStudioSettings() (+44 more)

### Community 4 - "useAgentSettingsMutationController.ts"
Cohesion: 0.06
Nodes (56): AgentPermissionsDraft, CRON_ACTION_BUSY_MESSAGE, CronBusyState, CronCreateDeps, isCronActionBusy(), performCronCreateFlow(), resolveCreateAgentId(), resolveCreateErrorMessage() (+48 more)

### Community 5 - "navigation.ts"
Cohesion: 0.06
Nodes (61): AGENT_RADIUS, BEDROOM_DOOR_Y, BEDROOM_ROOM_END_X, BEDROOM_ROOM_WIDTH, BEDROOM_ROOM_X, CANVAS_H, CANVAS_W, DOOR_LENGTH (+53 more)

### Community 6 - "OfficeScreen.tsx"
Cohesion: 0.04
Nodes (69): buildGenerateCompanyPlanPrompt(), buildImproveCompanyBriefPrompt(), HQSidebar(), HQSidebarProps, HQSidebarTab, PRIMARY_TABS, TAB_LABELS, formatClockTime() (+61 more)

### Community 7 - "react"
Cohesion: 0.09
Nodes (64): SCALE, FURNITURE_ROTATION, getItemBaseSize(), getItemRotationRadians(), resolveItemTypeKey(), toWorld(), getBrushedMetalTextures(), getFabricTextures() (+56 more)

### Community 8 - "presentation.ts"
Cohesion: 0.05
Nodes (70): AgentSkillsPanelProps, DISPLAY_CLASSES, DISPLAY_LABELS, FILTERS, resolveHint(), SkillRowFilter, AgentSkillsSetupModal(), AgentSkillsSetupModalProps (+62 more)

### Community 9 - "presence.ts"
Cohesion: 0.12
Nodes (24): GET(), POST(), runtime, stripRemoteAgentPrefix(), AgentsListResult, POST(), resolveLatestAssistantHistoryText(), runtime (+16 more)

### Community 10 - "constants.ts"
Cohesion: 0.06
Nodes (50): ATM_MIGRATION_KEY, BEDROOM_MIGRATION_KEY, BUMP_RECOVERY_MS, CONVERSATION_APPROACH_SPEED, DESK_STICKY_MS, EAST_HALL_WIDTH, EAST_WING_DOOR_Y, EAST_WING_ROOM_HEIGHT (+42 more)

### Community 11 - "gatewayRuntimeEventHandler.ts"
Cohesion: 0.08
Nodes (46): createGatewayRuntimeEventHandler(), findAgentByRunId(), GatewayRuntimeEventHandler, GatewayRuntimeEventHandlerDeps, resolveRole(), dedupeRunLines(), appendToolLinesEffects(), applyRuntimeTerminalCommands() (+38 more)

### Community 12 - "GatewayClient"
Cohesion: 0.08
Nodes (18): EventFrame, GatewayConnectionState, GatewayGapInfo, GatewayStatus, createRuntimeProvider(), DemoRuntimeProvider, HermesRuntimeProvider, hasRuntimeCapability() (+10 more)

### Community 13 - "pixel-office/types.ts"
Cohesion: 0.05
Nodes (73): SettingsPanel(), JANITOR_LOOK, mirrorSprite(), paintSpriteToContext(), spriteHeight(), spriteWidth(), TRANSPARENT_CHARS, buildPixelAgentInputs() (+65 more)

### Community 14 - "settings.ts"
Cohesion: 0.07
Nodes (38): useStudioOfficePreference(), UseStudioOfficePreferenceParams, DEFAULT_REMOTE_OFFICE_SOURCE_KIND, defaultStudioOfficePreference(), defaultStudioOfficePreferencePublic(), defaultStudioStandupJiraConfig(), defaultStudioStandupPreference(), defaultStudioStandupScheduleConfig() (+30 more)

### Community 15 - "furniture.ts"
Cohesion: 0.25
Nodes (55): aquarium(), arcade(), atm(), bookshelf(), buildFurnitureSprites(), chair(), coffeeMachine(), coffeeTable() (+47 more)

### Community 16 - "loadStudioSettings"
Cohesion: 0.08
Nodes (41): isSafeAgentId(), POST(), PUT(), resolveAgentStateSshTarget(), RestoreAgentStateRequest, runtime, TrashAgentStateRequest, expandTildeLocal() (+33 more)

### Community 17 - "GatewayBrowserClient.ts"
Cohesion: 0.07
Nodes (38): base64UrlDecode(), base64UrlEncode(), buildDeviceAuthPayload(), buildScopedTokenKey(), bytesToHex(), clearDeviceAuthToken(), CryptoLike, DeviceAuthEntry (+30 more)

### Community 18 - "spotify-jukebox/store.ts"
Cohesion: 0.09
Nodes (47): BrowserJukeboxCommand, BrowserJukeboxExecutionResult, executeBrowserJukeboxCommand(), normalize(), parseBrowserJukeboxCommand(), stripPlayPrefix(), base64urlEncode(), buildRedirectUri() (+39 more)

### Community 19 - "AgentChatPanel.tsx"
Cohesion: 0.09
Nodes (35): AgentAvatar(), AgentChatComposer, AgentChatFinalItems, AgentChatPanelProps, AgentChatTranscript, AssistantIntroCard, AssistantMessageCard, CHAT_SELECT_STYLE (+27 more)

### Community 20 - "hermes3doctor.mjs"
Cohesion: 0.11
Nodes (47): checkFail(), checkPass(), checkWarn(), detectHermesModelHealth(), detectWorkspaceState(), formatErrorMessage(), loadDotenvFile(), loadRuntimeEnv() (+39 more)

### Community 21 - "AgentState"
Cohesion: 0.09
Nodes (39): executeAgentReconcileCommands(), GatewayClientLike, ReconcileCommand, ReconcileDispatchAction, runAgentReconcileOperation(), buildReconcileTerminalPatch(), ReconcileEligibility, resolveReconcileEligibility() (+31 more)

### Community 22 - "skills/types.ts"
Cohesion: 0.14
Nodes (24): getPackagedSkillById(), buildInstallerMessage(), escapeForJsonString(), getPathLeaf(), installPackagedSkillViaGatewayAgent(), isRootWorkspace(), normalizeOptional(), normalizeRequired() (+16 more)

### Community 23 - "custom/provider.ts"
Cohesion: 0.10
Nodes (27): CustomRuntimeProxyInput, fetchCustomRuntimeJson(), normalizeCustomBaseUrl(), probeCustomRuntime(), requestCustomRuntime(), ActiveRunRecord, buildChatFailureMessage(), buildIdentityAgent() (+19 more)

### Community 24 - "runtimeEventBridge.ts"
Cohesion: 0.10
Nodes (33): extractReasoningBody(), hasReasoningSignal(), hasUnclosedThinkingTag(), isReasoningOnlyAssistantChunk(), normalizeReasoningComparable(), planRuntimeAgentEvent(), resolveThinkingFromAgentStream(), RuntimeAgentWorkflowResult (+25 more)

### Community 25 - "agentConfig.ts"
Cohesion: 0.08
Nodes (50): How Studio Chooses the Default Workspace Path, Studio -> Gateway: “Create Agent” End-to-End, AgentHeartbeat, AgentHeartbeatActiveHours, AgentHeartbeatResult, AgentHeartbeatSummary, AgentHeartbeatUpdatePayload, AgentSkillsAccessMode (+42 more)

### Community 26 - "fillRect"
Cohesion: 0.11
Nodes (44): Accessory, Appearance, buildCharacterFrames(), CAP_COLORS, danceGrid(), darkenHex(), drawAccessoriesBack(), drawAccessoriesFront() (+36 more)

### Community 27 - "useChatInteractionController.ts"
Cohesion: 0.07
Nodes (34): DraftFlushIntent, DraftTimerIntent, NewSessionIntent, planDraftFlushIntent(), planDraftTimerIntent(), planNewSessionIntent(), planStopRunIntent(), StopRunIntent (+26 more)

### Community 28 - "eventTriggers.ts"
Cohesion: 0.09
Nodes (32): How Office Motion Works, applyHoldDirective(), BooleanByAgentId, buildOfficeAnimationState(), clearOfficeAnimationTriggerHold(), createOfficeAnimationTriggerState(), emptyObject(), isUserLikeChatRole() (+24 more)

### Community 29 - "resolveStateDir"
Cohesion: 0.11
Nodes (27): contentTypeFromName(), GET(), runtime, uploadsDir(), ALLOWED_CONTENT_TYPES, ALLOWED_EXTENSIONS, CONTENT_TYPE_BY_EXT, isTextContentType() (+19 more)

### Community 30 - "AgentsPageScreen.tsx"
Cohesion: 0.08
Nodes (39): AgentsListResult, ExecApprovalsSnapshot, GatewayClientLike, hydrateAgentFleetFromGateway(), HydrateAgentFleetResult, isRecord(), parseIdentityNameFromContent(), resolveAgentsListFromHelloSnapshot() (+31 more)

### Community 31 - "QA Department Spec"
Cohesion: 0.05
Nodes (40): Agent Interaction Model, Approval-Aware Review, Approvals, Approved, Blocked, Bug Triage, Bulletin Board, Changes Requested (+32 more)

### Community 32 - "QA Department Spec"
Cohesion: 0.05
Nodes (40): Agent Interaction Model, Approval-Aware Review, Approvals, Approved, Blocked, Bug Triage, Bulletin Board, Changes Requested (+32 more)

### Community 33 - "execApprovalRuntimeCoordinator.ts"
Cohesion: 0.08
Nodes (32): EMPTY_EVENT_EFFECTS, ExecApprovalFollowUpIntent, NO_FOLLOW_UP_INTENT, resolveExecApprovalFollowUpIntent(), shouldTreatExecApprovalResolveErrorAsUnknownId(), normalizeExecAsk(), shouldPauseRunForPendingExecApproval(), GatewayClientLike (+24 more)

### Community 34 - "AgentCreateWizardModal.tsx"
Cohesion: 0.08
Nodes (38): AgentCreateWizardModal(), AgentCreateWizardModalProps, buildInitialDraft(), WizardField(), WizardStepId, wizardSteps, WizardTextAreaField(), AgentEditorModalProps (+30 more)

### Community 35 - "__init__.py"
Cohesion: 0.07
Nodes (8): build_publish_url(), build_turn_frame(), _default_home_token(), _handle_post_llm_call(), register(), _resolve_profile(), _resolve_token(), OfficePublisher

### Community 36 - "GatewayClient.ts"
Cohesion: 0.04
Nodes (59): Reconnects And Retries, Studio Settings (Where Gateway URL/Token Come From), AgentSessionState, applySessionSettingMutation(), ApplySessionSettingMutationParams, buildErrorPrefix(), buildFallbackError(), buildWebchatBlockedMessage() (+51 more)

### Community 37 - "agentMessaging.ts"
Cohesion: 0.14
Nodes (19): buildAgentHandoffInstruction(), buildDirectedAgentMessageInstruction(), GatewayAgentsListResult, GatewayCallLike, resolveLabel(), resolveSessionKeyFromAgentList(), RuntimeAgentHandoffPayload, RuntimeAgentMessagePayload (+11 more)

### Community 38 - "coordinator.ts"
Cohesion: 0.07
Nodes (36): fetchJson(), AnalyticsPatch, AvatarsPatch, createStudioSettingsCoordinator(), DeskAssignmentsPatch, fetchStudioSettings(), FocusedPatch, mergeAnalyticsPatch() (+28 more)

### Community 39 - "Agent State Model Spec"
Cohesion: 0.05
Nodes (38): Agent State Model Spec, Blocked, Bulletin Board, Core Principle, Degraded, Desk Progression / Hierarchy, Error, Existing Code Seams (+30 more)

### Community 40 - "mutationLifecycleWorkflow.ts"
Cohesion: 0.10
Nodes (26): AgentConfigMutationLifecycleDeps, AgentConfigMutationLifecycleKind, assertMutationKind(), AwaitingRestartPatch, buildConfigMutationFailureMessage(), buildMutatingMutationBlock(), buildMutationSideEffectCommands(), CreateAgentBlockState (+18 more)

### Community 41 - "conversations.ts"
Cohesion: 0.08
Nodes (30): buildNameMatchers(), CENTER_CANDIDATE_OFFSETS, clamp(), computeConversationSlots(), connectedComponents(), CONVERSATION_EN_ROUTE_GRACE_MS, CONVERSATION_MAX_LIFETIME_MS, CONVERSATION_MIN_LIFETIME_MS (+22 more)

### Community 42 - "Desk Progression Spec"
Cohesion: 0.05
Nodes (37): Agent Interaction Model, Bulletin Board / Whiteboard, Contractor, Contractor Desk, Core Principle, Desk Progression Spec, Employee, Employee Desk (+29 more)

### Community 43 - "Desk Progression Spec"
Cohesion: 0.05
Nodes (37): Agent Interaction Model, Bulletin Board / Whiteboard, Contractor, Contractor Desk, Core Principle, Desk Progression Spec, Employee, Employee Desk (+29 more)

### Community 44 - "colorSemantics.ts"
Cohesion: 0.17
Nodes (18): AGENT_STATUS_BADGE_CLASS, AGENT_STATUS_LABEL, GATEWAY_STATUS_BADGE_CLASS, GATEWAY_STATUS_LABEL, NEEDS_APPROVAL_BADGE_CLASS, resolveAgentStatusBadgeClass(), resolveAgentStatusLabel(), resolveGatewayStatusBadgeClass() (+10 more)

### Community 45 - "EventFrame"
Cohesion: 0.16
Nodes (18): asNonEmptyString(), asOptionalString(), asPositiveTimestamp(), asRecord(), parseExecApprovalRequested(), parseExecApprovalResolved(), RequestedPayload, ResolvedPayload (+10 more)

### Community 46 - "deskDirectives.ts"
Cohesion: 0.10
Nodes (35): cacheIntentSnapshot(), getCachedIntentSnapshot(), intentSnapshotCache, normalizeDirectiveText(), normalizeOfficeCallCallee(), normalizeOfficeTextRecipient(), OfficeCallDirective, OfficeCallPhase (+27 more)

### Community 47 - "Office Systems Roadmap"
Cohesion: 0.05
Nodes (36): Agent State Model, Auth And Enterprise Adoption, Bulletin Board, Candidate Feature Order, Core Direction, Current Post-Merge Sequence, Departments, Design Principles (+28 more)

### Community 48 - "planning.ts"
Cohesion: 0.11
Nodes (32): CommandModeId, CreatedAgentRecord, runCompanyBootstrapOperation(), buildCompanyRolePermissionsDraft(), buildCompanyAgentBlueprints(), buildRoleAgentsMarkdown(), buildRoleHeartbeatMarkdown(), buildRoleIdentity() (+24 more)

### Community 49 - "visualSystems.tsx"
Cohesion: 0.09
Nodes (21): @react-three/drei, three, CoffeeMug(), GardenWorkspace, GardenWorkspaceProps, Laptop(), ModernChair(), OutdoorDesk() (+13 more)

### Community 50 - "office/store.ts"
Cohesion: 0.17
Nodes (25): asString(), PUT(), runtime, asString(), GET(), PUT(), runtime, createEmptyOfficeMap() (+17 more)

### Community 51 - "Bulletin Board Spec"
Cohesion: 0.06
Nodes (34): Agent Interaction, Agent Sessions, Announcements, Authoring Rules, Basic Interactions, Blockers, Bulletin Board Spec, Card Fields (+26 more)

### Community 52 - "Bulletin Board Spec"
Cohesion: 0.06
Nodes (34): Agent Interaction, Agent Sessions, Announcements, Authoring Rules, Basic Interactions, Blockers, Bulletin Board Spec, Card Fields (+26 more)

### Community 53 - "Whiteboard Spec"
Cohesion: 0.06
Nodes (34): Architecture Planning, Authoring Rules, Brainstorming, Bulletin Board, Company Builder / Org Planning, Example: Meeting Notes Template, Example: Planning Session Template, Existing Code Seams (+26 more)

### Community 54 - "Whiteboard Spec"
Cohesion: 0.06
Nodes (34): Architecture Planning, Authoring Rules, Brainstorming, Bulletin Board, Company Builder / Org Planning, Example: Meeting Notes Template, Example: Planning Session Template, Existing Code Seams (+26 more)

### Community 55 - "shared-store.ts"
Cohesion: 0.15
Nodes (28): DELETE(), errorJson(), GET(), isRecord(), json(), PUT(), isTaskBoardSource(), normalizeTaskBoardStatus() (+20 more)

### Community 56 - "useUsageAnalytics.ts"
Cohesion: 0.07
Nodes (61): AnalyticsPanel(), DatePickerField(), formatBudgetInput(), formatDuration(), formatPercent(), openNativeDatePicker(), parseBudgetInput(), StatCard() (+53 more)

### Community 57 - "Meeting Room Workflow Spec"
Cohesion: 0.06
Nodes (33): Agent Interaction Model, Archived, Bulletin Board Integration, Complete, Core Principle, Decision, Existing Code Seams, Existing Foundation (+25 more)

### Community 58 - "Meeting Room Workflow Spec"
Cohesion: 0.06
Nodes (33): Agent Interaction Model, Archived, Bulletin Board Integration, Complete, Core Principle, Decision, Existing Code Seams, Existing Foundation (+25 more)

### Community 59 - "chatItems.ts"
Cohesion: 0.14
Nodes (30): AgentChatRenderBlock, appendThinkingTraceEvent(), AssistantTraceEvent, buildAgentChatItems(), BuildAgentChatItemsInput, buildAgentChatRenderBlocks(), buildFinalAgentChatItems(), extractFirstCodeBlockLine() (+22 more)

### Community 60 - "models.ts"
Cohesion: 0.16
Nodes (18): asRecord(), GatewayConnectionStatus, GatewayModelsSyncIntent, RecordLike, resolveGatewayConfigRecord(), resolveGatewayModelsSyncIntent(), resolveSandboxRepairAgentIds(), resolveSandboxRepairIntent() (+10 more)

### Community 61 - "useTaskBoardController.ts"
Cohesion: 0.16
Nodes (31): RunRecord, buildActiveRunOptions(), buildCardFromExplicitEvent(), buildCardFromGatewayTask(), buildCardFromSharedTaskRecord(), buildPlaybookCards(), buildStandupSeedCards(), cardTextKey() (+23 more)

### Community 62 - "pathfinding.ts"
Cohesion: 0.09
Nodes (29): Builder Stack, Immersive Office Stack, Office Architecture, AgentEffectsSystem, AgentEffectsSystemParams, AvatarState, stateColor(), thoughtFromSeed() (+21 more)

### Community 63 - "Hierarchy And Teams Spec"
Cohesion: 0.06
Nodes (32): Agent Interaction Model, Contractor, Core Principle, Delegation Model, Executive, Existing Code Seams, Future Extensions, Goal (+24 more)

### Community 64 - "Hierarchy And Teams Spec"
Cohesion: 0.06
Nodes (32): Agent Interaction Model, Contractor, Core Principle, Delegation Model, Executive, Existing Code Seams, Future Extensions, Goal (+24 more)

### Community 65 - "message-extract.ts"
Cohesion: 0.10
Nodes (33): classifyGatewayEventKind(), getChatSummaryPatch(), formatHermesEventLogEntry(), shouldSuppressPhoneBoothAssistantReply(), AgentInstructionParams, buildAgentInstruction(), ENVELOPE_CHANNELS, EXEC_APPROVAL_AUTO_RESUME_MARKER (+25 more)

### Community 66 - "vitest"
Cohesion: 0.08
Nodes (21): react, @testing-library/react, vitest, applyTheme(), getPreferredTheme(), ThemeMode, ThemeToggle(), AgentChatPanel() (+13 more)

### Community 67 - "with"
Cohesion: 0.06
Nodes (31): env, IMAGE_NAME, REGISTRY, jobs, publish, name, contents, packages (+23 more)

### Community 68 - "browser-preview/route.ts"
Cohesion: 0.10
Nodes (32): BrowserOpenResponse, browserRequest(), BrowserScreenshotResponse, BrowserTab, BrowserTabsResponse, buildBrowserHeaders(), ensurePreviewTab(), GET() (+24 more)

### Community 69 - "runtimeChatEventWorkflow.ts"
Cohesion: 0.11
Nodes (26): planRuntimeChatEvent(), resolveTerminalSeq(), RuntimeChatWorkflowCommand, RuntimeChatWorkflowInput, RuntimeChatWorkflowResult, summarizeThinkingMessage(), terminalAssistantFinalEntryId(), terminalAssistantMetaEntryId() (+18 more)

### Community 70 - "useOfficeSkillTriggers.ts"
Cohesion: 0.07
Nodes (42): AgentSkillsPanel(), SkillsMarketplaceModal(), SkillsMarketplaceModalProps, buildSearchBlob(), FILTER_LABELS, formatInstalls(), formatRating(), getAgentSkillEnabled() (+34 more)

### Community 71 - "atmosphere.tsx"
Cohesion: 0.20
Nodes (13): WORLD_H, WORLD_W, DaylightDrift(), DustMotes(), FollowFocusUpdater(), hash1(), OFFICE_ENVIRONMENT_HDR, ParkTree() (+5 more)

### Community 72 - "schema.ts"
Cohesion: 0.11
Nodes (31): asBoolean(), asNumber(), asString(), defaultLayers(), isRecord(), normalizeAmbiencePreset(), normalizeDeskAssignments(), normalizeInteractionKind() (+23 more)

### Community 73 - "agentPermissionsOperation.ts"
Cohesion: 0.06
Nodes (51): Capabilities Permissions Updates, Debug Checklist (When Something Feels “Wrong”), Gateway: Exec Approvals (Policy + Events), Gateway: Tool Availability and `workspaceAccess=ro`, Gateway: What `agents.create` Actually Does, Glossary, Mental Model (First Principles), One-Shot Sandbox Tool Policy Repair (+43 more)

### Community 74 - "OfficePhaserCanvas.tsx"
Cohesion: 0.13
Nodes (18): phaser, OfficePhaserCanvas(), OfficePhaserCanvasProps, createOfficeBuilderScene(), OfficeBuilderRenderable, createOfficeSceneBridge(), OfficeDebugSettings, OfficeRuntimeSettings (+10 more)

### Community 75 - "StudioSettingsCoordinator"
Cohesion: 0.17
Nodes (7): Params, useOfficeFloorRuntimePersistence(), FloorId, StudioSettingsCoordinator, defaultStudioSettings(), HookParams, makeCoordinator()

### Community 76 - "profile.ts"
Cohesion: 0.10
Nodes (29): AgentAvatarEditorPanelHandle, AgentAvatarEditorPanelProps, AGENT_AVATAR_BOTTOM_STYLE_OPTIONS, AGENT_AVATAR_CLOTHING_COLOR_OPTIONS, AGENT_AVATAR_GENDER_OPTIONS, AGENT_AVATAR_HAIR_COLOR_OPTIONS, AGENT_AVATAR_HAIR_STYLE_OPTIONS, AGENT_AVATAR_HAT_STYLE_OPTIONS (+21 more)

### Community 77 - "presence.ts"
Cohesion: 0.14
Nodes (24): runtime, SummaryStatusSnapshot, normalizeRemoteGatewayUrl(), useRemoteOfficePresence(), UseRemoteOfficePresenceParams, UseRemoteOfficePresenceResult, buildAgentMainSessionKey(), buildOfficePresenceSnapshotFromGateway() (+16 more)

### Community 78 - "environment.tsx"
Cohesion: 0.15
Nodes (33): cached(), CanvasContext, EMPTY_SET, fbm(), getCarpetTextures(), getConcreteTextures(), getGrassTextures(), getPlasterTextures() (+25 more)

### Community 79 - "Multi-Agent Beta"
Cohesion: 0.07
Nodes (27): 1. Remote Hermes3D Presence Endpoint, 2. Remote Gateway, Connection Modes, Current Beta Limitations, Disable Behavior, Gateway mode connects but messaging fails, How To Connect, Mental Model (+19 more)

### Community 80 - "next"
Cohesion: 0.07
Nodes (10): nextConfig, securityHeaders, next, runtime, MAX_VOICE_UPLOAD_BYTES, runtime, display, metadata (+2 more)

### Community 81 - "standup/store.ts"
Cohesion: 0.17
Nodes (19): GET(), PUT(), runtime, advanceStandupMeeting(), startStandupSpeaker(), updateStandupArrivals(), defaultStore(), ensureDirectory() (+11 more)

### Community 82 - "store.tsx"
Cohesion: 0.06
Nodes (61): buildHistoryMetadataPatch(), HistoryRequestIntent, HistoryResponseDisposition, resolveHistoryFetchLimit(), resolveHistoryRequestIntent(), resolveHistoryResponseDisposition(), areStringArraysEqual(), ChatHistoryMessage (+53 more)

### Community 83 - "TaskBoardView.tsx"
Cohesion: 0.18
Nodes (14): TaskBoardPanel(), KanbanImmersiveScreen(), CardChip(), formatPlatform(), formatRelativeTime(), formatScheduledFor(), PLATFORM_LABELS, STATUS_META (+6 more)

### Community 84 - "Hermes3Doctor Spec"
Cohesion: 0.07
Nodes (27): Auth / Token Checks, Custom Runtime, First-Pass Scope, Follow-Up Docs, Gateway Reachability, Goal, Hermes, Hermes3D Settings / Environment (+19 more)

### Community 85 - "lucide-react"
Cohesion: 0.15
Nodes (21): lucide-react, AgentsStep(), AgentsStepProps, CompanyStep(), CompanyStepProps, CompleteStep(), ConnectStep(), ConnectStepProps (+13 more)

### Community 86 - "settings-store.ts"
Cohesion: 0.10
Nodes (33): GET(), PUT(), readGatewayUrl(), runtime, POST(), runtime, GET(), isPatch() (+25 more)

### Community 87 - "execApprovalControlLoopWorkflow.ts"
Cohesion: 0.09
Nodes (27): AutoResumeIntent, ExecApprovalIngressCommand, ExecApprovalPendingSnapshot, PauseRunIntent, planAutoResumeIntent(), planIngressCommands(), planPausedRunMapCleanup(), planPauseRunIntent() (+19 more)

### Community 88 - "personalityBuilder.ts"
Cohesion: 0.16
Nodes (22): buildIdentityFileDraft(), AgentFilesInput, cleanLabel(), cleanValue(), IDENTITY_PLACEHOLDER_VALUES, isIdentityPlaceholder(), isSectionHeading(), isUserContextPlaceholder() (+14 more)

### Community 89 - "createPayloadBuilder.ts"
Cohesion: 0.06
Nodes (52): AgentInspectHeader(), AgentInspectHeaderProps, AgentSettingsPanel(), applyTemplateDefaults(), arePermissionsDraftEqual(), createInitialCronDraft(), CRON_TEMPLATE_OPTIONS, CronTemplateOption (+44 more)

### Community 90 - "Runtime Profile Architecture"
Cohesion: 0.08
Nodes (25): 1. `docs: runtime profile architecture`, 2. `feat: hermes3doctor`, 3. `refactor: office shell modularization`, 4. `docs: floor schema and builder plan`, 5. `feat: admin floor builder`, Branch Sequence, Core Terms, Custom Runtime Position (+17 more)

### Community 91 - "bridge.js"
Cohesion: 0.14
Nodes (20): asString(), createHermesAgentUpstream(), CRON_STATUSES, DURATION_UNIT_MS, errorMessage(), fallbackAgent(), parseTimestampMs(), resErr() (+12 more)

### Community 92 - "AgentAvatarGlbModel.tsx"
Cohesion: 0.12
Nodes (19): AgentAvatarGlbAnimation, CANDIDATES, Props, ALLOWED_AVATAR_URL_PREFIXES, ANIME_AVATAR_PRESETS, AnimeAvatarPreset, findAnimePresetByUrl(), findAnimePresetModelUrl() (+11 more)

### Community 93 - "agentFleetHydrationDerivation.ts"
Cohesion: 0.12
Nodes (22): AgentsListResult, DerivedHydrateAgentFleetResult, DeriveFleetHydrationInput, deriveHydrateAgentFleetResult(), ExecApprovalsSnapshot, ExecAsk, ExecHost, ExecPolicyEntry (+14 more)

### Community 94 - "Office Systems Roadmap"
Cohesion: 0.08
Nodes (24): Agent State Model, Bulletin Board, Candidate Feature Order, Core Direction, Departments, Design Principles, Desk / CPU Progression, Hierarchy (+16 more)

### Community 95 - "call/mock.ts"
Cohesion: 0.23
Nodes (13): normalizeText(), PhoneCallRequestBody, POST(), runtime, buildMockPhoneCallScenario(), buildPromptText(), buildRecipientReply(), buildSpokenText() (+5 more)

### Community 96 - "agents.tsx"
Cohesion: 0.27
Nodes (15): AgentAvatarGlbModel(), PreviewFigure(), AvatarFeminineHair(), AvatarLashes(), AvatarLegClothing(), AvatarSkirt(), Box(), Vec3 (+7 more)

### Community 97 - "settingsRouteWorkflow.ts"
Cohesion: 0.16
Nodes (24): buildSettingsRouteHref(), InspectSidebarState, parseSettingsRouteAgentIdFromPathname(), parseSettingsRouteAgentIdFromQueryParam(), planBackToChatCommands(), planFleetSelectCommands(), planNonRouteSelectionSyncCommands(), planOpenSettingsRouteCommands() (+16 more)

### Community 98 - "[0.1.4] - 2026-04-23"
Cohesion: 0.08
Nodes (23): [0.1.0] - 2026-03-16, [0.1.1] - 2026-03-19, [0.1.2] - 2026-03-20, [0.1.3] - 2026-03-28, [0.1.4] - 2026-04-23, Added, Added, Added (+15 more)

### Community 99 - "service.ts"
Cohesion: 0.22
Nodes (18): buildJiraSearchUrl(), buildSourceState(), buildSpeech(), buildStandupMeeting(), coerceText(), dedupePullRequests(), expandRange(), getZonedDateParts() (+10 more)

### Community 100 - "SmsBoothImmersiveScreen.tsx"
Cohesion: 0.14
Nodes (19): normalizeText(), POST(), runtime, TextMessageRequestBody, Bubble(), ContactList(), KEYBOARD_ROWS, KeyboardKey() (+11 more)

### Community 101 - "GithubImmersiveScreen.tsx"
Cohesion: 0.16
Nodes (19): getDiffLineTone(), GitHubDiffFile, ParsedDiffLine, parseDiffPatch(), FileDiffModal(), FileDiffModalProps, BrowserPreviewState, useBrowserPreview() (+11 more)

### Community 102 - "mergeStudioSettings"
Cohesion: 0.18
Nodes (15): DEFAULT_ACTIVE_FLOOR_ID, FloorDefinition, FloorKind, FloorProvider, FloorZone, getOfficeFloor(), HERMES_FLOOR, listEnabledOfficeFloors() (+7 more)

### Community 103 - "Hermes3D + Hermes + Tailscale Setup Tutorial"
Cohesion: 0.08
Nodes (24): 0) Architecture and Responsibilities, 10) Security Notes, 1) Prerequisites, 2.1 Start the Hermes API server, 2.2 Configure the adapter, 2.3 Run the adapter, 2.4 Verify adapter health, 2.5 Note your gateway token (+16 more)

### Community 104 - "Hermes3D — A 3D Workspace for AI Agents"
Cohesion: 0.09
Nodes (23): Common Setups, Configuration, Contributing, Current Limitations, Demo mode, Documentation, Gateway local, Studio local, Gateway remote, Studio local (+15 more)

### Community 105 - "demo-gateway-adapter.js"
Cohesion: 0.13
Nodes (19): activeRuns, activeSendEventFns, ADAPTER_PORT, agentListPayload(), agents, broadcastEvent(), buildDemoReply(), clearHistory() (+11 more)

### Community 106 - "createDefaultAgentAvatarProfile"
Cohesion: 0.19
Nodes (15): AgentAvatarCreatorModal(), AgentAvatarCreatorModalProps, AgentAvatarEditorPanel, AgentAvatarPreview3D(), AgentEditorModal(), buildRoleAvatarProfile(), CompanyBuilderModal(), CompanyBuilderModalProps (+7 more)

### Community 107 - "Custom Runtime Provider Spec"
Cohesion: 0.09
Nodes (21): Capability Philosophy, Core Principle, Current Branch Status, Custom Metadata Surface, Custom Runtime Provider Spec, Event Model, Goal, Implementation Strategy (+13 more)

### Community 108 - "dependencies"
Cohesion: 0.08
Nodes (25): dependencies, canvas-confetti@^1.9.4, clsx@^2.1.1, lucide-react@^0.563.0, next@16.1.7, @noble/ed25519@^3.0.0, phaser@^3.90.0, react@19.2.3 (+17 more)

### Community 109 - "devDependencies"
Cohesion: 0.10
Nodes (20): devDependencies, jsdom@^27.4.0, @playwright/test@^1.58.0, tailwindcss@^4, @testing-library/react@^16.3.2, tw-animate-css@^1.4.0, @types/canvas-confetti@^1.9.0, @types/react@^19 (+12 more)

### Community 110 - "hermes-gateway-adapter.js"
Cohesion: 0.10
Nodes (18): activeRuns, activeSendEventFns, ADAPTER_PORT, AGENT_FILES_FILE, agentFiles, agentRegistry, AGENTS_FILE, conversationHistory (+10 more)

### Community 111 - "tasks/types.ts"
Cohesion: 0.12
Nodes (18): compareCards(), sortTaskBoardCards(), TaskBoardAction, taskBoardReducer(), upsertTaskBoardCard(), defaultTaskBoardPreference(), isTaskBoardStatus(), LEGACY_STATUS_MAP (+10 more)

### Community 112 - "standup/types.ts"
Cohesion: 0.13
Nodes (15): sourceTone(), StandupImmersiveScreen(), StandupCommitSummary, StandupConfig, StandupConfigPayload, StandupJiraConfig, StandupManualEntry, StandupMeeting (+7 more)

### Community 113 - "Architecture"
Cohesion: 0.10
Nodes (20): 1. Gateway-owned state, 2. Studio-owned local state, 3. Client-server boundary, 4. Browser-gateway boundary, Agent runtime flow, Architecture, Connection flow, Constraints (+12 more)

### Community 114 - "README.md"
Cohesion: 0.12
Nodes (10): Code Of Conduct, Enforcement, Expected Behavior, Our Pledge, Unacceptable Behavior, Roadmap, Maintainer Contact Notes, Public Help (+2 more)

### Community 115 - "package.json"
Cohesion: 0.13
Nodes (14): class-variance-authority@^0.7.1, react-mentions-ts@^5.4.7, @tailwindcss/postcss@^4, @types/node@^20, @types/react-dom@^19, license, name, private (+6 more)

### Community 116 - "randomUUID"
Cohesion: 0.27
Nodes (9): AgentCreateModal(), AgentCreateModalContent(), AgentCreateModalProps, resolveInitialName(), CryptoLike, randomUUID(), uuidFromBytes(), weakRandomBytes() (+1 more)

### Community 117 - "github.ts"
Cohesion: 0.41
Nodes (14): loadPullRequestDetail(), loadPullRequestFiles(), normalizeComments(), normalizeCommits(), normalizeFiles(), normalizeLabels(), normalizeReviews(), normalizeStatusChecks() (+6 more)

### Community 118 - "Custom Provider Reference"
Cohesion: 0.10
Nodes (19): Agent Mapping, Capability Profile, Current Implementation Notes, Custom Provider Reference, Event Mapping, Explicit Non-Goals, Goal, Position (+11 more)

### Community 119 - "handleMethod"
Cohesion: 0.18
Nodes (20): broadcastEvent(), clearHistory(), execConfigureAgent(), execDelegateTask(), execDismissAgent(), execListTeam(), execReadAgentContext(), execSpawnAgent() (+12 more)

### Community 120 - "layout/route.ts"
Cohesion: 0.17
Nodes (20): fetchRemoteOfficeLayoutSnapshot(), GET(), PUT(), runtime, useRemoteOfficeLayout(), UseRemoteOfficeLayoutParams, UseRemoteOfficeLayoutResult, deriveRemoteLayoutUrlFromPresenceUrl() (+12 more)

### Community 122 - "Code Documentation"
Cohesion: 0.09
Nodes (23): API Route Inventory, Code Documentation, Contributor Footguns, Documentation Philosophy, Folder Structure Conventions, How Desk Assignment Works, How To Add A New 3D Object, How To Add A New Room Or Activity (+15 more)

### Community 123 - "components.json"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 124 - "index.js"
Cohesion: 0.16
Nodes (14): selfsigned@^5.5.0, selfsigned, createAccessGate(), createRateLimiter(), parseCookies(), resolveClientIp(), safeCompare(), CERT_DIR (+6 more)

### Community 125 - "chatSendOperation.ts"
Cohesion: 0.14
Nodes (16): Sending Messages (Browser -> PI via Gateway), extractImmediateAssistantText(), GatewayClientLike, resolveChatSendCompletionMode(), sendChatMessageViaStudio(), SendDispatch, SendDispatchAction, buildHistoryLines() (+8 more)

### Community 126 - "makeGrid"
Cohesion: 0.27
Nodes (18): Grid, gridRows(), makeGrid(), makeSprite(), buildGroundTileSprites(), carpetTile(), grassTile(), gymMatTile() (+10 more)

### Community 128 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 129 - "Skills in Hermes3D"
Cohesion: 0.11
Nodes (18): 10.1 Route and navigation model, 10.2 Skills tab data and interactions, 10.3 Mutation wiring from Studio, 10.4 Scope warning shown in Studio, 10) Hermes3D UX (current behavior), 11) What recent `.agent/done` plans show, 12) UX redesign constraints that are not optional, 13) Practical mental model for reviewing a Skills screenshot (+10 more)

### Community 130 - "deskMonitor.ts"
Cohesion: 0.19
Nodes (15): AgentChatItem, buildOfficeDeskMonitor(), deriveEditorDocument(), derivePseudoEditor(), extractDomains(), extractPath(), extractUrls(), flattenMonitorEntry() (+7 more)

### Community 131 - "useConfigMutationQueue.ts"
Cohesion: 0.18
Nodes (12): ConfigMutationGateInput, shouldStartNextConfigMutation(), GatewayStatus, observeGatewayRestart(), RestartObservation, ActiveConfigMutation, ConfigMutationKind, mutationRequiresIdleAgents() (+4 more)

### Community 132 - "runtimeAgentEventWorkflow.test.ts"
Cohesion: 0.20
Nodes (8): RuntimeAgentWorkflowCommand, RuntimeAgentWorkflowInput, RuntimeTerminalCommand, RuntimeTerminalState, createAgent(), createInput(), createPayload(), InputOverrides

### Community 133 - "upstreamUrlDiagnostics.ts"
Cohesion: 0.23
Nodes (10): hasBlockingUpstreamUrlFinding(), HERMES_AGENT_DASHBOARD_PORT, HERMES_AGENT_WS_PATH, HERMES_OPENAI_API_PORT, inspectUpstreamGatewayUrl(), isTailnetHostname(), TAILSCALE_TLS_PORTS, UpstreamUrlFinding (+2 more)

### Community 134 - "normalizeCommandText"
Cohesion: 0.20
Nodes (18): resolveOfficeCallDirective(), resolveOfficeTextDirective(), applyUserMessageTriggers(), buildPhoneCallDirectiveKey(), buildStableLatestRequestSeed(), buildTextMessageDirectiveKey(), createPhoneCallRequest(), createTextMessageRequest() (+10 more)

### Community 135 - "specialLatestUpdateOperation.ts"
Cohesion: 0.11
Nodes (24): buildLatestUpdatePatch(), LatestUpdateIntent, LatestUpdateKind, resolveLatestUpdateIntent(), resolveLatestUpdateKind(), ChatHistoryMessage, ChatHistoryResult, createSpecialLatestUpdateOperation() (+16 more)

### Community 136 - "AgentsPageScreen.tsx"
Cohesion: 0.14
Nodes (21): planAwaitingUserInputPatches(), planPendingPruneDelay(), planPrunedPendingState(), runPauseRunForExecApprovalOperation(), runResolveExecApprovalOperation(), AgentCreateModalSubmitPayload, applyCreateAgentBootstrapPermissions(), executeCreateAgentBootstrapCommands() (+13 more)

### Community 137 - "custom/route.ts"
Cohesion: 0.33
Nodes (7): CustomRuntimeRequestBody, isRuntimeUrlAllowed(), normalizeMethod(), normalizePathname(), normalizeRuntimeUrl(), POST(), runtime

### Community 138 - "buildAgentMainSessionKey"
Cohesion: 0.26
Nodes (12): buildSkillRemovalMessage(), escapeForJsonString(), normalizeRequired(), removeSkillViaGatewayAgent(), resolveAllowedRoot(), resolveMainKey(), resolveRemovalWorkspace(), resolveRunId() (+4 more)

### Community 139 - "HermesAgentJsonRpcClient"
Cohesion: 0.20
Nodes (4): buildJsonRpcUrl(), describeCloseCode(), HermesAgentJsonRpcClient, isHostRejection()

### Community 140 - "ref_node_path"
Cohesion: 0.09
Nodes (23): main(), parseArgs(), tryReadGatewayTokenFromHermesConfig(), isRecord(), loadUpstreamGatewaySettings(), readHermesGatewayDefaults(), readJsonFile(), resolveDefaultHomeDir() (+15 more)

### Community 141 - "studioRoute.ts"
Cohesion: 0.25
Nodes (5): @playwright/test, createStudioRoute(), DEFAULT_SETTINGS, stubStudioRoute(), StudioSettingsFixture

### Community 142 - "path-suggestions/route.ts"
Cohesion: 0.29
Nodes (9): GET(), isWithinHome(), listPathAutocompleteEntries(), normalizeQuery(), PathAutocompleteEntry, PathAutocompleteOptions, PathAutocompleteResult, resolveRealPath() (+1 more)

### Community 143 - "createAgentBootstrapOperation.ts"
Cohesion: 0.22
Nodes (11): CREATE_AGENT_DEFAULT_PERMISSIONS, CreateCompletion, CreatedAgent, resolveBootstrapErrorMessage(), runCreateAgentBootstrapOperation(), buildBootstrapGlobalErrorMessage(), buildBootstrapModalErrorMessage(), buildMissingCreatedAgentMessage() (+3 more)

### Community 144 - "Hermes Gateway Adapter"
Cohesion: 0.13
Nodes (15): 1. Start Hermes, 2. Configure environment, 3. Start Hermes3D and the adapter, 4. Remote Hermes on another machine, 5. Optional all-in-one local startup, ACP status, Architecture, Current limitations (+7 more)

### Community 145 - "kanban.js"
Cohesion: 0.20
Nodes (11): asTrimmed(), kanbanOriginFromWsUrl(), kanbanRequest(), READ_STATUS, toHermes3dKanbanTaskRecord(), toHermes3dKanbanTasks(), toIsoTime(), toKanbanPatchBody() (+3 more)

### Community 146 - "github/route.ts"
Cohesion: 0.16
Nodes (27): GET(), parsePullRequestNumber(), POST(), ReviewRequestBody, runtime, extractCommandMessage(), getGitHubAuthState(), GitHubAuthState (+19 more)

### Community 147 - "scripts"
Cohesion: 0.13
Nodes (15): scripts, build, cleanup:ux-artifacts, demo-gateway, dev, dev:https, doctor, e2e (+7 more)

### Community 148 - "gateway-proxy.js"
Cohesion: 0.28
Nodes (14): buildErrorResponse(), createFrameRateLimiter(), createGatewayProxy(), hasCompleteDeviceAuth(), hasNonEmptyDeviceToken(), hasNonEmptyPassword(), hasNonEmptyToken(), injectAuthToken() (+6 more)

### Community 149 - "cleanup-ux-artifacts.mjs"
Cohesion: 0.21
Nodes (12): cleanupPlaywrightProcesses(), clearDirContents(), ensureDir(), killPattern(), main(), removeIfPresent(), repoRoot, run() (+4 more)

### Community 150 - "useOnboardingState.ts"
Cohesion: 0.33
Nodes (8): emitChange(), listeners, OnboardingStateReturn, readCompleted(), readCompletedOnServer(), subscribe(), useOnboardingState(), writeCompleted()

### Community 151 - "Creating Skills"
Cohesion: 0.14
Nodes (13): 1. Create the skill files, 2. Mirror the files into `src/lib/skills/packaged.ts`, 3. Register the skill in `src/lib/skills/catalog.ts`, 4. Add marketplace presentation metadata, 5. Understand where the files get installed, 6. Keep the example production-ready, 7. Verify your changes, Creating Skills (+5 more)

### Community 152 - "PI + Chat Streaming (Studio Side)"
Cohesion: 0.15
Nodes (13): Debugging Checklist (When Chat “Feels Buggy”), High-Level Network Path, History Sync (Recovery, Load More), How Chat UI Renders Streaming, Key Files (Start Here), Media Rendering (Images From Agent Output), PI + Chat Streaming (Studio Side), Post-Connect Side Effects (Local Gateway Only) (+5 more)

### Community 153 - "eslint.config.mjs"
Cohesion: 0.25
Nodes (7): eslintConfig, eslint@^9, eslint-config-next@16.1.6, eslint-config-prettier@^10.1.8, eslint, eslint-config-next, eslint-config-prettier

### Community 154 - "useOfficeStandupController.ts"
Cohesion: 0.24
Nodes (13): everyoneArrived(), expandRange(), getZonedParts(), isMeetingActive(), matchesCronPart(), OfficeStandupController, sameScheduledMinute(), shouldRunNow() (+5 more)

### Community 155 - "gateway.ts"
Cohesion: 0.26
Nodes (11): createGatewayTask(), deleteGatewayTask(), GatewayTaskCreateInput, GatewayTaskRecord, GatewayTasksListResult, GatewayTaskUpdateInput, isUnsupportedTaskGatewayError(), KANBAN_TASK_ID_PREFIX (+3 more)

### Community 157 - "Runtime Profiles"
Cohesion: 0.15
Nodes (12): Current Profiles, Current Runtime Contract, `custom`, `demo`, `hermes`, `hermes3d`, `local`, Multi-Agent Message Contract (+4 more)

### Community 158 - "AgentAvatarProfile"
Cohesion: 0.20
Nodes (15): AgentAvatarProps, AvatarBodyShape, BODY_SHAPES, getAvatarBodyShape(), AgentAvatarGender, AgentAvatarProfile, blendHex(), buildAgentAvatarPortraitDataUrl() (+7 more)

### Community 159 - "useOfficeBuilderStore.ts"
Cohesion: 0.16
Nodes (17): OfficeBuilderPage(), nextId(), OfficeBuilderPanel(), OfficeBuilderPanelProps, BuilderAction, BuilderHistory, BuilderSelection, BuilderState (+9 more)

### Community 160 - "Universal Backend Plan"
Cohesion: 0.17
Nodes (11): Capability Matrix, Core Adapter Contract, Hermes Provider, Proposed First Deliverable, Provider Strategy, Recommendation, Target Architecture, Universal Backend Plan (+3 more)

### Community 161 - "Critical Fixes"
Cohesion: 0.17
Nodes (11): 1. Telemetry Removed, 2. Constant-Time Token Comparison, 3. Auth Rate Limiting, 4. WebSocket Frame Validation, 5. Upstream URL Allowlist, 6. Custom Runtime Proxy Allowlist, 7. Security Headers, 8. Media Route Symlink Rejection (+3 more)

### Community 164 - "voiceReply/provider.ts"
Cohesion: 0.19
Nodes (12): POST(), runtime, VoiceReplyRequestBody, normalizeVoiceReplyText(), useVoiceReplyPlayback(), VoiceReplyPlaybackRequest, normalizeVoiceId(), normalizeVoiceSpeed() (+4 more)

### Community 165 - "shared-store-client.ts"
Cohesion: 0.30
Nodes (10): archiveSharedTaskRecord(), fetchWithTimeout(), isRetryable(), listSharedTaskRecords(), parseResponse(), sleep(), TaskStoreRequestError, upsertSharedTaskRecord() (+2 more)

### Community 166 - "Hermes3D Vision"
Cohesion: 0.17
Nodes (12): Architecture Direction, Contribution Rules, Core Architecture, Current Priorities, Developer Ergonomics, Hermes3D Vision, Long-Term Direction, Relationship to the Backend (+4 more)

### Community 167 - "agentSettingsMutationWorkflow.ts"
Cohesion: 0.17
Nodes (13): AgentSettingsMutationContext, AgentSettingsMutationDecision, AgentSettingsMutationDenyReason, AgentSettingsMutationRequest, CronActionKind, GuardedActionKind, isCronActionBusy(), isGuardedAction() (+5 more)

### Community 168 - "Task Manager"
Cohesion: 0.20
Nodes (9): File format, Matching rules, Required workflow, Response rules, Status rules, Storage location, Task fields, Task Manager (+1 more)

### Community 169 - "TODO Board"
Cohesion: 0.20
Nodes (9): Field rules, File format, Mutation rules, Required workflow, Response style, Storage location, Supported actions, TODO Board (+1 more)

### Community 170 - "Connect Hermes3D to a remote hermes-agent over Tailscale"
Cohesion: 0.20
Nodes (10): 1. Pin a session token, 2. Start the backend on loopback, 3. Publish it on the tailnet, 4. Keep it running, Connect Hermes3D to a remote hermes-agent over Tailscale, Machine A — the Hermes host, Machine B — the Hermes3D host, Security notes (+2 more)

### Community 171 - "Agent Bus Integration"
Cohesion: 0.20
Nodes (9): Agent Bus Integration, Architecture, Event Schema, Events Emitted, Gateway Protocol Compatibility, How It Works, Key Differences from the Hermes Backend, Links (+1 more)

### Community 172 - "sanitizeErrorMessage"
Cohesion: 0.31
Nodes (10): getAgentWorkspace(), loadBrainSettingsFromDisk(), loadHistoryFromDisk(), readAgentBrainFile(), redactSecrets(), sanitizeErrorMessage(), saveAgentFilesToDisk(), seedDefaultOrchestratorBrainFiles() (+2 more)

### Community 174 - "multiavatar.ts"
Cohesion: 0.33
Nodes (8): AVATAR_ACCENTS, AVATAR_FOREGROUNDS, AVATAR_PALETTE, buildAvatarDataUrl(), buildAvatarLabel(), buildAvatarSvg(), hashSeed(), pick()

### Community 175 - "transcription.ts"
Cohesion: 0.36
Nodes (8): buildVoiceTranscriptionErrorMessage(), inferVoiceFileExtension(), MIME_EXTENSION_MAP, normalizeVoiceMimeType(), sanitizeVoiceFileName(), shouldIgnoreVoiceTranscription(), TranscriptionDecision, VoiceTranscriptionResult

### Community 176 - "Contributing"
Cohesion: 0.22
Nodes (9): Before you start, Contributing, Local setup, Minimal issue template, Minimal PR template, Pull requests, Reporting issues, Support And Routing (+1 more)

### Community 177 - "agent"
Cohesion: 0.22
Nodes (9): Event Model, Behavior Source Of Truth, End-To-End Flow (PI Run -> UI), `event: "agent"` payload, `event: "chat"` payload, Exec Approvals In Chat (Related To “PI Runs”), Live Fields vs Committed Transcript (Why Streaming Can “Look Weird”), Streaming: What the Gateway Sends and How Studio Uses It (+1 more)

### Community 178 - "Roadmap"
Cohesion: 0.22
Nodes (8): Already In Progress Or Partially Covered, Before Starting Bigger Work, Good First Contribution Areas, Later, Next, Now, Product Ideas To Reduce Backend Dependency, Roadmap

### Community 179 - "hermes3d-start.sh"
Cohesion: 0.44
Nodes (8): find_free_port(), info(), log(), pids_on_port(), port_free(), port_owned_by(), hermes3d-start.sh script, warn()

### Community 180 - "office-speech.js"
Cohesion: 0.15
Nodes (7): ws, buildEventsUrl(), createOfficeSpeechSubscriber(), open(), parseTurnFrame(), RECONNECT_BACKOFF_MS, redactUrl()

### Community 181 - "network-policy.js"
Cohesion: 0.53
Nodes (7): assertPublicHostAllowed(), isIpv4Loopback(), isIpv6Loopback(), isPublicHost(), normalizeHost(), resolveHost(), resolveHosts()

### Community 184 - "gatewayClient.reconnect-recovery.test.ts"
Cohesion: 0.22
Nodes (4): GatewayBrowserClient, instances, MockClientOptions, MockInstance

### Community 185 - "Development environment instructions"
Cohesion: 0.25
Nodes (7): Agent Instructions, Build, Development environment instructions, Gotchas, Lint, typecheck, and tests, Running the app, Service overview

### Community 186 - "Gateway Skill Contract"
Cohesion: 0.25
Nodes (7): Agent workflow, Authentication model, Channel behavior, Gateway Skill Contract, RPC methods the gateway skill should expose, SOUNDHERMES, Trigger

### Community 187 - "Showing outside conversations in the office"
Cohesion: 0.25
Nodes (7): Configuration, How it works, Install, Requirements, Showing outside conversations in the office, Troubleshooting, What you see in the office

### Community 188 - "SceneErrorBoundary"
Cohesion: 0.22
Nodes (3): SceneErrorBoundary, SceneErrorBoundaryProps, SceneErrorBoundaryState

### Community 190 - "plugin.yaml"
Cohesion: 0.25
Nodes (7): author, description, hooks, kind, name, platforms, version

### Community 191 - "deploy-local.sh"
Cohesion: 0.36
Nodes (6): err(), log(), NEXT_TELEMETRY_DISABLED, PATH, deploy-local.sh script, warn()

### Community 192 - "completeOneTurn"
Cohesion: 0.36
Nodes (8): completeOneTurn(), extractOpenAiStyleError(), fetchHermesModels(), hermesGet(), hermesPost(), readJsonBody(), resolveHermesModel(), streamOneTurn()

### Community 194 - "officeSpeech.ts"
Cohesion: 0.36
Nodes (5): asString(), OFFICE_SPEECH_MAX_AGE_MS, OfficeSpeechFeedEvent, ParseOptions, toOfficeSpeechFeedEvent()

### Community 196 - "GatewayConnectScreen.tsx"
Cohesion: 0.11
Nodes (25): OfficeLoadingFallback(), OfficePage(), readDebugFlag(), GatewayConnectScreen(), GatewayConnectScreenProps, resolveLocalGatewayPort(), box(), RunningAvatarLoader() (+17 more)

### Community 197 - "9) Troubleshooting"
Cohesion: 0.29
Nodes (7): `401` or auth errors from Hermes3D, 9) Troubleshooting, Connecting to the hermes-agent dashboard port (`9119`) instead of the adapter, `EPROTO` or `wrong version number`, Hermes3D connects but no agents appear, Tailscale URL works nowhere, The backend itself is unhealthy

### Community 198 - "Quick Start"
Cohesion: 0.33
Nodes (6): Connect Claude Code Hooks, Connect Hermes3D, Prerequisites, Quick Start, Send Your First Event, Setup (5 minutes)

### Community 199 - "High-Value PR Split"
Cohesion: 0.33
Nodes (6): High-Value PR Split, PR 1: Runtime Abstraction, PR 2: Safe UX Cherry-Picks, PR 3: Hermes Native Provider, PR 4: Vera Provider, PR 5: Optional Compatibility Layer Cleanup

### Community 200 - "contact_links"
Cohesion: 0.33
Nodes (5): blank_issues_enabled, contact_links, about, name, url

### Community 201 - "Security Policy"
Cohesion: 0.33
Nodes (5): Current Security Limitations, Deployment Notes, Reporting A Vulnerability, Scope, Security Policy

### Community 203 - "useStudioVoiceRepliesPreference.ts"
Cohesion: 0.53
Nodes (5): useStudioVoiceRepliesPreference(), UseStudioVoiceRepliesPreferenceParams, defaultStudioVoiceRepliesPreference(), resolveVoiceRepliesPreference(), StudioVoiceRepliesPreference

### Community 204 - "Gateway: Sandbox Semantics"
Cohesion: 0.40
Nodes (5): Gateway: Sandbox Semantics, Hard Enforcement: Filesystem Tool Root Guard, Sandbox Mode (`sandbox.mode`), Sandbox Scope (`sandbox.scope`), Workspace Access (`sandbox.workspaceAccess`)

### Community 205 - "smoke-dev-server.mjs"
Cohesion: 0.60
Nodes (3): getFreePort(), main(), sleep()

### Community 212 - "WebSocket Frame Shapes"
Cohesion: 0.67
Nodes (3): Connect failures, Connect handshake, WebSocket Frame Shapes

## Knowledge Gaps
- **2 isolated node(s):** `PATH`, `NEXT_TELEMETRY_DISABLED`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2160 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `RetroOffice3D.tsx`, `isRecord`, `useAgentSettingsMutationController.ts`, `navigation.ts`, `presentation.ts`, `gatewayRuntimeEventHandler.ts`, `pixel-office/types.ts`, `loadStudioSettings`, `GatewayBrowserClient.ts`, `AgentChatPanel.tsx`, `hermes3doctor.mjs`, `AgentState`, `skills/types.ts`, `runtimeEventBridge.ts`, `agentConfig.ts`, `useChatInteractionController.ts`, `eventTriggers.ts`, `resolveStateDir`, `AgentsPageScreen.tsx`, `execApprovalRuntimeCoordinator.ts`, `AgentCreateWizardModal.tsx`, `GatewayClient.ts`, `coordinator.ts`, `mutationLifecycleWorkflow.ts`, `conversations.ts`, `colorSemantics.ts`, `EventFrame`, `deskDirectives.ts`, `planning.ts`, `shared-store.ts`, `chatItems.ts`, `models.ts`, `useTaskBoardController.ts`, `message-extract.ts`, `browser-preview/route.ts`, `runtimeChatEventWorkflow.ts`, `useOfficeSkillTriggers.ts`, `agentPermissionsOperation.ts`, `StudioSettingsCoordinator`, `next`, `standup/store.ts`, `store.tsx`, `TaskBoardView.tsx`, `lucide-react`, `settings-store.ts`, `execApprovalControlLoopWorkflow.ts`, `createPayloadBuilder.ts`, `bridge.js`, `settingsRouteWorkflow.ts`, `mergeStudioSettings`, `demo-gateway-adapter.js`, `createDefaultAgentAvatarProfile`, `devDependencies`, `tasks/types.ts`, `package.json`, `randomUUID`, `index.js`, `chatSendOperation.ts`, `deskMonitor.ts`, `useConfigMutationQueue.ts`, `runtimeAgentEventWorkflow.test.ts`, `upstreamUrlDiagnostics.ts`, `specialLatestUpdateOperation.ts`, `AgentsPageScreen.tsx`, `custom/route.ts`, `buildAgentMainSessionKey`, `ref_node_path`, `createAgentBootstrapOperation.ts`, `cleanup-ux-artifacts.mjs`, `useOnboardingState.ts`, `gateway.ts`, `navigation.diagonalCorner.test.ts`, `agentSettingsMutationWorkflow.ts`, `multiavatar.ts`, `transcription.ts`, `office-speech.js`, `network-policy.js`, `gatewayClient.reconnect-recovery.test.ts`, `officeSpeech.ts`, `GatewayConnectScreen.tsx`?**
  _High betweenness centrality (0.150) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `OfficeScreen()` (e.g. with `Current Post-Merge Sequence` and `Immediate Next Deliverables`) actually correct?**
  _`OfficeScreen()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `PATH`, `NEXT_TELEMETRY_DISABLED` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `palette.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.02857142857142857 - nodes in this community are weakly interconnected._
- **Why does `react` connect `vitest` to `RetroOffice3D.tsx`, `useConfigMutationQueue.ts`, `useAgentSettingsMutationController.ts`, `OfficeScreen.tsx`, `specialLatestUpdateOperation.ts`, `presentation.ts`, `AgentsPageScreen.tsx`, `react`, `GatewayClient`, `pixel-office/types.ts`, `settings.ts`, `spotify-jukebox/store.ts`, `AgentChatPanel.tsx`, `AgentState`, `useOnboardingState.ts`, `useOfficeStandupController.ts`, `useChatInteractionController.ts`, `AgentAvatarProfile`, `useOfficeBuilderStore.ts`, `AgentCreateWizardModal.tsx`, `voiceReply/provider.ts`, `GatewayClient.ts`, `colorSemantics.ts`, `EventFrame`, `visualSystems.tsx`, `useUsageAnalytics.ts`, `models.ts`, `useTaskBoardController.ts`, `SceneErrorBoundary`, `GatewayConnectScreen.tsx`, `browser-preview/route.ts`, `useOfficeSkillTriggers.ts`, `atmosphere.tsx`, `OfficePhaserCanvas.tsx`, `StudioSettingsCoordinator`, `profile.ts`, `presence.ts`, `environment.tsx`, `useStudioVoiceRepliesPreference.ts`, `store.tsx`, `TaskBoardView.tsx`, `lucide-react`, `createPayloadBuilder.ts`, `AgentAvatarGlbModel.tsx`, `agents.tsx`, `settingsRouteWorkflow.ts`, `GithubImmersiveScreen.tsx`, `createDefaultAgentAvatarProfile`, `dependencies`, `package.json`, `randomUUID`, `layout/route.ts`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Should `furnitureDefaults.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Why does `Code Documentation` connect `Code Documentation` to `README.md`, `eventTriggers.ts`, `pathfinding.ts`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._