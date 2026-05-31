# Brain Coach Voice Context Examples

These examples show the prompt context produced by PR #252 plus the Brain Coach voice-context layer. They use existing `cognitive_session_index` rows, the current streak calculation, today's Brain Coach plan, and recent activity history.

## Completed Activity Yesterday

Flow example:

```text
User opens or asks for Brain Coach voice
-> Voice context loads cognitive_session_index
-> Context sees Memory Match completed yesterday
-> Daily plan recommends Rhythm Tap and Word Recall
-> Voice opens with a short activity prompt
```

Sample voice prompt:

```text
Recommended voice opening: "Would you like to try Rhythm Tap for about 4 minutes?"
Reason to say aloud if useful: new area for variety.
If the user accepts, open /attention-boosters/rhythm-tap with the app action tool using domain brain_coach.
```

Context lines:

```text
Completed yesterday: Memory Match.
Brain Coach was completed yesterday. Acknowledge continuity briefly and offer today's short plan.
Current Brain Coach streak: 1 day. Reinforce that one completed activity keeps momentum going.
Today's Brain Coach plan: Rhythm Tap (attention, 4 min); Word Recall (episodic memory, 5 min).
```

## Lapsed User

Flow example:

```text
User asks for a brain activity after a gap
-> Voice context finds the last completed activity 13 days ago
-> Plan stays short
-> Voice avoids guilt and offers one easy restart
```

Sample voice prompt:

```text
Recommended voice opening: "Would you like to try Rhythm Tap for about 4 minutes?"
Reason to say aloud if useful: new area for variety.
If the user accepts, open /attention-boosters/rhythm-tap with the app action tool using domain brain_coach.
```

Context lines:

```text
Lapsed Brain Coach user: last completed activity was 13 days ago. Keep the restart low-pressure and positive.
No active Brain Coach streak. Focus on one clear completion today.
Today's Brain Coach plan: Rhythm Tap (attention, 4 min); Memory Match (visual memory, 4 min).
```

## Active Streak User

Flow example:

```text
User returns with a 3-day Brain Coach streak
-> Voice context sees an activity was completed today
-> Plan avoids repeating recent games
-> Voice offers another short option only if the user wants more
```

Sample voice prompt:

```text
Recommended voice opening: "Would you like to try Story Recall for about 5 minutes?"
Reason to say aloud if useful: new area for variety.
If the user accepts, open /memory-games/story_recall with the app action tool using domain brain_coach.
```

Context lines:

```text
Brain Coach already has a completed activity today. Offer to continue only if the user wants more.
Current Brain Coach streak: 3 days. Mention momentum if it feels encouraging.
Today's Brain Coach plan: Story Recall (language, 5 min); Spatial Navigator (spatial navigation, 5 min).
```

## New User

Flow example:

```text
New user asks for Brain Coach
-> Voice context finds no completed Brain Coach history
-> Plan starts with a balanced short session
-> Voice invites one first activity without mentioning missed sessions
```

Sample voice prompt:

```text
Recommended voice opening: "Would you like to try Rhythm Tap for about 4 minutes?"
Reason to say aloud if useful: new area for variety.
If the user accepts, open /attention-boosters/rhythm-tap with the app action tool using domain brain_coach.
```

Context lines:

```text
New Brain Coach user: do not mention missed sessions. Invite one short first activity.
No active Brain Coach streak. Focus on one clear completion today.
Today's Brain Coach plan: Rhythm Tap (attention, 4 min); Memory Match (visual memory, 4 min).
```
