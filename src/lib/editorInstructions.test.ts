import { describe, expect, it } from "vitest";
import {
  DIRECTOR_NOTES_REQUIRED_PLAN,
  appendDirectorNotesTemplate,
  hasPlanTierAccess,
  normalizeDirectorNotesPrompt,
} from "./editorInstructions";

describe("editorInstructions", () => {
  it("normalizes multi-line director notes", () => {
    expect(normalizeDirectorNotesPrompt("  remove   00:10-00:20  \r\n\r\n keep it smooth   ")).toBe(
      "remove 00:10-00:20\nkeep it smooth",
    );
  });

  it("appends example templates cleanly", () => {
    expect(appendDirectorNotesTemplate("Keep the setup", "Remove 00:10-00:20")).toBe(
      "Keep the setup\nRemove 00:10-00:20",
    );
  });

  it("gates director notes to creator tier and above", () => {
    expect(hasPlanTierAccess("starter", DIRECTOR_NOTES_REQUIRED_PLAN)).toBe(false);
    expect(hasPlanTierAccess("creator", DIRECTOR_NOTES_REQUIRED_PLAN)).toBe(true);
    expect(hasPlanTierAccess("studio", DIRECTOR_NOTES_REQUIRED_PLAN)).toBe(true);
  });
});
