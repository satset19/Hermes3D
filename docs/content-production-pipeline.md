# Content Production Pipeline Specification

## Overview

This document specifies the pipeline for multi-agent content generation and asset handoff. The workflow is partitioned into explicit operational stages and remains capability-gated until external generation and cloud storage providers are formally verified.

## Lifecycle States

Each stage in the pipeline uses one of the following states:

- `not_configured`: Required model, API key, credentials, or remote endpoints are missing.
- `ready`: Stage prerequisites are satisfied and awaiting input.
- `running`: Execution is currently active.
- `failed`: An execution or validation error occurred.
- `complete`: Artifacts are verified and safely handed off.

## Production Stages & Handoffs

### Stage 1: Briefing & Content Strategy
- **Role**: Content Lead / Orchestrator
- **Input**: Raw concept or prompt from user
- **Output**: Content Header and Brief
  - Target audience and objective
  - Core messaging pillars
  - Tone, style, and platform target
  - Execution constraints

### Stage 2: Narrative Architecture
- **Role**: Narrative Writer
- **Input**: Content Header and Brief
- **Output**: 4-part structured narrative:
  1. **Hook**: Attention-grabbing opening frame.
  2. **Bridge / Problem**: Contextual setup and tension.
  3. **Body / Value**: Core informative or entertaining content.
  4. **Call to Action (CTA)**: Specific closing viewer prompt.

### Stage 3: Production Script Formatter
- **Role**: Script Formatter
- **Input**: 4-part structured narrative
- **Output**: 5-column standard production table:
  1. `Scene / Duration`: Scene number and timing bounds.
  2. `Visual / Camera Angle`: Shot composition, subject motion, camera directions.
  3. `Audio`: Spoken dialog, voiceover lines, or voice pacing notes.
  4. `Text on Screen`: Lower-thirds, titles, captions, or typography cues.
  5. `SFX / BGM`: Sound effects and background music suggestions.

### Stage 4: Visual Generation (Gated)
- **Role**: Visual Asset Generator
- **Status**: `not_configured`
- **Input**: Visual descriptions and scene durations from the production script table.
- **Output**: Generated video/visual artifacts.
- **Execution Rules**:
  - Gated pending verified Google Flow API or automated session integration.
  - No generation is reported as complete without a verifiable file hash or direct response handle.
  - Ephemeral buffer only: any local staging must be written to temporary storage and deleted immediately upon transfer.

### Stage 5: Cloud Storage & Distribution Handoff (Gated)
- **Role**: Storage Handler
- **Status**: `not_configured`
- **Input**: Visual generation output stream.
- **Output**: Google Drive file link and confirmation of cleanup.
- **Execution Rules**:
  - Direct upload to Google Drive without persistent retention on VPS disk.
  - Ephemeral buffers on VPS must be verified deleted immediately post-upload.
  - Return verifiable shared URL and permissions status.

## Open Integration Prerequisites

Before Stage 4 and Stage 5 can be transitioned from `not_configured` to `ready`:

1. **Provider Verification**: Validate exact API endpoints or authenticated web sessions for Google Flow.
2. **Model Availability**: Confirm availability of required models across active providers.
3. **Storage Authentication**: Ensure Google Workspace / Drive OAuth credentials with bounded scope are installed.
4. **Retention Policy**: Verify zero-byte permanent disk storage on VPS; ephemeral buffers must be wiped and verified clean.
