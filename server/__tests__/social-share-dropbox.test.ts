import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authMiddleware } from "../middleware/auth.js";

const { openAiToFileMock, openAiTranscriptionCreateMock } = vi.hoisted(() => ({
  openAiToFileMock: vi.fn(),
  openAiTranscriptionCreateMock: vi.fn(),
}));

vi.mock("openai", () => {
  class MockOpenAI {
    static toFile = openAiToFileMock;

    audio = {
      transcriptions: {
        create: openAiTranscriptionCreateMock,
      },
    };
  }

  return { default: MockOpenAI };
});

import socialRoomsRouter from "../routes/socialRooms.js";

function app() {
  const testApp = express();
  testApp.use(express.json({ limit: "12mb" }));
  testApp.use("/api/social", authMiddleware, socialRoomsRouter);
  return testApp;
}

describe("social Share Drop Box API", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    openAiToFileMock.mockReset();
    openAiTranscriptionCreateMock.mockReset();
  });

  it("transcribes and stores private voice-note audio", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
    openAiToFileMock.mockResolvedValue("share-audio-file");
    openAiTranscriptionCreateMock.mockResolvedValue({ text: "Stand By Me always reminds me of Sunday lunch" });

    const params = new URLSearchParams({
      noteType: "song",
      lang: "en",
      durationMs: "1200",
      promptId: "song-old-favourite",
      promptText: "What song would you like to share today?",
      promptKind: "song",
      connectionGoal: "Find someone who remembers this song too.",
    });

    const res = await request(app())
      .post(`/api/social/share-dropbox/notes/audio?${params.toString()}`)
      .set("x-user-id", "share-voice-user")
      .set("Content-Type", "audio/webm")
      .send(Buffer.alloc(64, 1))
      .expect(201);

    expect(res.body.note).toMatchObject({
      noteType: "song",
      status: "ready",
      editedText: "Stand By Me always reminds me of Sunday lunch",
      suggestedRoomSlug: "music-room",
      promptId: "song-old-favourite",
      promptKind: "song",
      connectionGoal: "Find someone who remembers this song too.",
      connectionLabel: "See the Music Room",
    });
    expect(res.body.note.audio.url).toBe(`/api/social/share-dropbox/notes/${res.body.note.id}/audio`);
    expect(openAiToFileMock).toHaveBeenCalledWith(expect.any(Buffer), "share-dropbox.webm", { type: "audio/webm" });
    expect(openAiTranscriptionCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      file: "share-audio-file",
      model: "gpt-4o-mini-transcribe",
      prompt: expect.stringContaining("social voice note"),
    }));

    await request(app())
      .get(res.body.note.audio.url)
      .set("x-user-id", "share-voice-user")
      .expect(200)
      .expect("Content-Length", "64");
  });

  it("returns a setup error when voice transcription is not configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const res = await request(app())
      .post("/api/social/share-dropbox/notes/audio?noteType=memory")
      .set("x-user-id", "share-no-openai-user")
      .set("Content-Type", "audio/webm")
      .send(Buffer.alloc(64, 1))
      .expect(503);

    expect(res.body).toEqual({ error: "Voice transcription is not configured." });
    expect(openAiTranscriptionCreateMock).not.toHaveBeenCalled();
  });

  it("keeps unsafe notes private and blocks publishing", async () => {
    const createRes = await request(app())
      .post("/api/social/share-dropbox/notes")
      .set("x-user-id", "share-unsafe-user")
      .send({
        noteType: "hello",
        transcript: "Text me outside the app at 123456789",
        editedText: "Text me outside the app at 123456789",
        lang: "en",
      })
      .expect(201);

    expect(createRes.body.note).toMatchObject({
      status: "blocked",
      suggestedRoomSlug: "together-room",
    });
    expect(createRes.body.note.safetyFlags).toContain("private_contact");

    const publishRes = await request(app())
      .post(`/api/social/share-dropbox/notes/${createRes.body.note.id}/publish`)
      .set("x-user-id", "share-unsafe-user")
      .send({ lang: "en" })
      .expect(400);

    expect(publishRes.body.error).toContain("needs VYVA review");
    expect(publishRes.body.note.status).toBe("blocked");
  });

  it("returns the Share Stories home loop with prompts and recent notes", async () => {
    const createRes = await request(app())
      .post("/api/social/share-dropbox/notes")
      .set("x-user-id", "share-home-user")
      .send({
        noteType: "recipe",
        transcript: "Add parsley at the end",
        editedText: "Add parsley at the end",
        promptId: "recipe-family-table",
        promptText: "What recipe or kitchen tip would you like to save?",
        promptKind: "recipe",
        connectionGoal: "Invite kitchen memories and tips.",
        lang: "en",
      })
      .expect(201);

    const homeRes = await request(app())
      .get("/api/social/share-stories/home?lang=en")
      .set("x-user-id", "share-home-user")
      .expect(200);

    expect(homeRes.body.todayPrompt).toMatchObject({
      id: expect.any(String),
      promptText: expect.any(String),
    });
    expect(homeRes.body.prompts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "song-old-favourite", noteType: "song", roomName: "Music Room" }),
      expect.objectContaining({ id: "recipe-family-table", noteType: "recipe", roomName: "Kitchen Table" }),
    ]));
    expect(homeRes.body.recentNotes[0]).toMatchObject({
      id: createRes.body.note.id,
      promptId: "recipe-family-table",
      connectionLabel: "See Kitchen Table",
    });
    expect(homeRes.body.stats).toMatchObject({
      sharedThisWeek: 1,
      readyCount: 1,
    });
  });

  it("publishes safe song notes into the Music Room circle", async () => {
    const createRes = await request(app())
      .post("/api/social/share-dropbox/notes")
      .set("x-user-id", "share-music-user")
      .send({
        noteType: "song",
        transcript: "Stand By Me",
        editedText: "Stand By Me",
        lang: "en",
      })
      .expect(201);

    const publishRes = await request(app())
      .post(`/api/social/share-dropbox/notes/${createRes.body.note.id}/publish`)
      .set("x-user-id", "share-music-user")
      .send({ lang: "en" })
      .expect(200);

    expect(publishRes.body.note).toMatchObject({
      status: "placed",
      placementKind: "music_circle_item",
      suggestedRoomSlug: "music-room",
      connectionLabel: "See the Music Room",
    });
    expect(publishRes.body.item).toMatchObject({
      songText: "Stand By Me",
      status: "active",
    });
    expect(publishRes.body.roomPath).toBe("/social-rooms/music-room");
    expect(publishRes.body.connection).toMatchObject({
      label: "See the Music Room",
      roomPath: "/social-rooms/music-room",
    });
  });
});
