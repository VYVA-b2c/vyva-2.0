# Voice Canvas multimodal interaction layer

Use `useVoiceCanvasMultimodalInteraction` when a Canvas flow supports voice, touch, and keyboard selection on the same visual scene.

The flow still owns state, validation, safety rules, and side effects. The shared layer owns the presentation timing around spoken choices:

- applies VYVA agent presence to the current view model
- marks the spoken choice as selected and `spokenSelected`
- exposes one polite screen-reader announcement through `spokenChoiceFeedback`
- waits briefly before committing the state event so the user can see what VYVA heard
- drops stale spoken choices if the scene changed before the delay finishes
- emits the next visual prompt to the voice bridge after the safe commit

Example:

```tsx
const stateRef = useRef(state);
useEffect(() => {
  stateRef.current = state;
}, [state]);

const baseViewModel = myFlowViewModel(state, copy, options);

const {
  viewModel,
  acknowledgeChoice,
  clearFeedback,
} = useVoiceCanvasMultimodalInteraction({
  viewModel: baseViewModel,
  agentPresenceCopy: copy.agentPresence,
  stateRef,
  reducer: myFlowReducer,
  dispatch,
  getStep: (nextState) => nextState.step,
  getViewModel: (nextState) => myFlowViewModel(nextState, copy, options),
});

function onTouchChoice(id: string) {
  clearFeedback();
  dispatch({ type: "CHOOSE_OPTION", id });
}

function onVoiceChoice(detail: VoiceUserMessageDetail) {
  const choice = findVoiceCanvasSpokenOption(
    options,
    detail.text,
    (option) => [option.label, ...(option.voiceAliases ?? [])],
  );
  if (!choice) return;

  acknowledgeChoice({
    choiceId: `option:${choice.id}`,
    label: choice.label,
    expectedStep: "option",
    event: { type: "CHOOSE_OPTION", option: choice },
    detail,
  });
}
```

Safety notes:

- Only use delayed spoken-choice acknowledgement for normal visual decisions.
- Keep urgent, blocked, cancel, back, retry, and explicit confirmation behavior in the flow so it can enforce its safety boundaries.
- Do not put transcripts, addresses, medication names, provider reply text, shopping item names, or other personal details into telemetry.
- External actions must still go through the flow's explicit confirmation gate.
