# VYVA Live Companion Canvas platform

This platform keeps presentation, conversation state, and external actions separate. `VoiceCanvasScene` renders copy supplied by a view model; a domain machine owns the draft; the integration owns voice and service calls.

## Adding a flow

1. Define a serializable domain state and reducer. Include a monotonic request ID and, when confirmed details can change, a revision number.
2. Reject unsafe restored states. Draft input may be restored, but `waiting`, `confirmed`, and in-flight requests must return to a review or blocked scene. Never resubmit restored work.
3. Build every visible string into the domain copy props and view model. Do not add a language dictionary to the visual component.
4. Use `useCanvasSessionReducer`, `useCanvasAccessibility`, and `CanvasLiveStatus`. Scene changes move focus to the heading; waiting, completed, and blocked states receive live announcements.
5. Use `useCanvasExternalActionGate` at the external-action boundary. Call `authorize` only in the explicit confirmation handler. Call `begin` immediately before the service request. Treat `null` as a duplicate. Check `isCurrent` before accepting any response.
6. Pass the current draft revision to both `authorize` and `begin`. Any material edit must increment the revision and invalidate the prior permit.
7. Parse rollout responses with `parseCanvasRolloutConfig` and evaluate them with `isCanvasRolloutEnabled`. Missing, malformed, disabled, or unreachable configuration fails closed to the existing experience.
8. Emit only `CanvasTelemetryEnvelope` fields. Do not add addresses, names, transcripts, medication information, provider details, free text, or saved-place contents.
9. Map review, waiting, service, and terminal steps through `canvasOutcomeForStep`. A prepared request is not pending; confirmation is not completion; failures are blocked.

## External-action boundary

The UI callback is not authorization by itself. The permit is short-lived and bound to both request ID and revision. A second submission for the same request is ignored, a newer request aborts the older controller, and late callbacks must be discarded.

Domain rules may be stricter than the common gate. Prescription validation, emergency routing, or provider-channel restrictions remain in the domain integration and must run before authorization.

## Required compliance coverage

Every flow must test voice, touch, and keyboard completion; no action before confirmation; duplicate attempts; material-change reconfirmation; stale responses; cancellation; reconnect and restoration; service failure and retry; focus and live announcements; Spanish long labels; reduced motion; mobile and tablet widths; and fail-closed fallback.

Use `voice-canvas-platform-gallery.html` to inspect all six flow names and the canonical prepared, pending, confirmed, completed, and blocked states. The gallery is presentation-only and does not perform external actions.

## Rollback

Each flow has an independent server flag and rollout percentage. Set its enable flag to false (or rollout to zero) to restore the existing experience. Clients refresh configuration and must exit the Canvas safely when a kill switch changes during a session.
