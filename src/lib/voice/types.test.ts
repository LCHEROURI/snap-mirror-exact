import { describe, expect, it } from "vitest";
import { micError, VOICE_MESSAGES } from "./types";

describe("microphone errors", () => {
  it("maps browser errors to a clear next step", () => {
    expect(micError({ name: "NotAllowedError" })).toBe("mic_blocked"); // denied or dismissed
    expect(micError({ name: "NotFoundError" })).toBe("no_mic");
    expect(micError({ name: "NotSupportedError" })).toBe("unsupported");
    expect(VOICE_MESSAGES.mic_blocked).toMatch(/browser settings/);
  });
});
