# Prescription follow-up Canvas rollout

Enable with `VYVA_ENABLE_PRESCRIPTION_FOLLOW_UP_VOICE_CANVAS=true` and set `VYVA_PRESCRIPTION_FOLLOW_UP_VOICE_CANVAS_ROLLOUT_PERCENT` from 1–100. The refill Canvas remains independently controlled.

The feature fails closed. Disable the flag to remove follow-up immediately; the completed refill preparation and existing Concierge fallback remain available. Follow-up writes only after explicit confirmation and always creates another preparation-only pending record with `auto_start:false`. A status check is read-only.

Operational language must preserve these distinctions: **prepared** is not submitted, **pending** is not approved, and neither means ready for collection. The client never infers approval or readiness. Telemetry contains only event name, scene, input mode, attempt, and restoration state—never medication, provider, notes, or entered information.

Browser evidence: `prescription-follow-up-desktop.png`, `prescription-follow-up-tablet.png`, and `prescription-follow-up-mobile.png` in this folder. The standalone harness is `/prescription-follow-up-canvas-integration.html`.
