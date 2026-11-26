import { describe, expect, it } from "vitest";
import { describeStates, expiryState, formatSalaryRange } from "@/lib/utils/format";
import { FIFTY_STATE_CODES } from "@/lib/config/reference-data";
import { buildEvidencePath, isOwnedEvidencePath } from "@/services/qualifications.service";
import { toServiceError } from "@/lib/security/errors";

const uid = "11111111-1111-4111-8111-111111111111";
const qid = "22222222-2222-4222-8222-222222222222";

describe("display helpers", () => {
  it("formats the salary range in USD", () => {
    expect(formatSalaryRange(120000, 150000)).toBe("$120,000 – $150,000");
    expect(formatSalaryRange(null, 150000)).toBe("Not set");
  });
  it("describes state selections", () => {
    expect(describeStates([...FIFTY_STATE_CODES])).toBe("All 50 states");
    expect(describeStates([...FIFTY_STATE_CODES, "DC"])).toBe("All 50 states + DC");
    expect(describeStates(["TX", "WY"])).toBe("Texas, Wyoming");
    expect(describeStates([])).toBe("None selected");
  });
  it("flags expiring and expired qualifications", () => {
    const today = new Date("2026-06-01T00:00:00Z");
    expect(expiryState(null, today)).toBe("none");
    expect(expiryState("2026-05-31", today)).toBe("expired");
    expect(expiryState("2026-07-15", today)).toBe("expiring");
    expect(expiryState("2027-07-15", today)).toBe("valid");
  });
});

describe("evidence file paths", () => {
  it("builds a path inside the owner's folder", () => {
    const p = buildEvidencePath(uid, qid, "NEBOSH Certificate (2020).PDF", 1700000000000);
    expect(p).toBe(`${uid}/${qid}/1700000000000-nebosh-certificate-2020-.pdf`);
    expect(isOwnedEvidencePath(uid, qid, p)).toBe(true);
  });
  it("rejects paths outside the owner's folder", () => {
    expect(isOwnedEvidencePath(uid, qid, `${qid}/${uid}/file.pdf`)).toBe(false);
    expect(isOwnedEvidencePath(uid, qid, `${uid}/${qid}/../x.pdf`)).toBe(false);
    expect(isOwnedEvidencePath(uid, qid, `${uid}/${qid}/a/b.pdf`)).toBe(false);
    expect(isOwnedEvidencePath(uid, qid, `${uid}/other/file.pdf`)).toBe(false);
  });
});

describe("error messages shown to the user", () => {
  it("passes through profile-completion guard messages", () => {
    expect(toServiceError({ message: "PROFILE_INCOMPLETE: review every imported record" }, "x").message).toBe(
      "review every imported record",
    );
  });
  it("does not leak raw database errors", () => {
    expect(toServiceError({ code: "XX000", message: "relation secret_table does not exist" }, "Could not save.").message).toBe(
      "Could not save.",
    );
  });
});
