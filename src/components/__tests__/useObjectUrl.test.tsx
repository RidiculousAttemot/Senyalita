import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useObjectUrl } from "@/components/admin/AnimationStudio/useObjectUrl";

/**
 * The studio's upload -> extract handoff, pinned.
 *
 * VideoUploadTab created one object URL, put it on VideoMetadata, and the
 * extract and preview tabs rendered `<video src={videoMeta.url}>`. The parent
 * renders tabs conditionally, so switching to extract UNMOUNTED the upload tab
 * and its cleanup revoked that exact URL. Extraction then loaded a dead blob
 * (ERR_FILE_NOT_FOUND) while duration and dimensions still read correctly,
 * because those had been copied into state before the revoke -- so the failure
 * looked like a corrupt video rather than a lifetime bug.
 *
 * The property that fixes it: whoever renders the URL owns it, and no other
 * component's unmount can invalidate it.
 */

let created: string[];
let revoked: string[];

beforeEach(() => {
  created = [];
  revoked = [];
  let n = 0;
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => {
      const u = `blob:test/${++n}`;
      created.push(u);
      return u;
    }),
    revokeObjectURL: vi.fn((u: string) => void revoked.push(u)),
  });
});

afterEach(() => vi.unstubAllGlobals());

function Consumer({ file }: { file: File | null }) {
  const url = useObjectUrl(file);
  return <video data-testid="v" src={url} />;
}

const fakeFile = (name = "clip.mov") => new File(["x"], name, { type: "video/quicktime" });

describe("useObjectUrl", () => {
  it("gives the consumer its own URL", () => {
    const { getByTestId } = render(<Consumer file={fakeFile()} />);
    expect(created).toHaveLength(1);
    expect(getByTestId("v").getAttribute("src")).toBe(created[0]);
  });

  it("does not revoke while the consumer is still mounted", () => {
    // The whole bug: the URL died while something was still rendering it.
    const { rerender } = render(<Consumer file={fakeFile()} />);
    rerender(<Consumer file={fakeFile("clip.mov")} />);
    // A different File instance is a different source, so the old one is
    // released -- but the currently rendered URL must never be revoked.
    expect(revoked).not.toContain(created[created.length - 1]);
  });

  it("releases its URL when the consumer unmounts", () => {
    const { unmount } = render(<Consumer file={fakeFile()} />);
    const mine = created[0];
    expect(revoked).not.toContain(mine);
    unmount();
    expect(revoked).toContain(mine);
  });

  it("one component unmounting does not invalidate another's URL", () => {
    // This is the regression. Two tabs, same File; the first unmounts on a tab
    // switch. The survivor's src must still be live.
    const file = fakeFile();
    const a = render(<Consumer file={file} />);
    const b = render(<Consumer file={file} />);
    expect(created).toHaveLength(2);
    const [urlA, urlB] = created;

    a.unmount();

    expect(revoked).toContain(urlA);
    expect(revoked, "the surviving tab's URL was revoked by its sibling").not.toContain(urlB);
    expect(b.getByTestId("v").getAttribute("src")).toBe(urlB);
  });

  it("renders no src for a missing file rather than a stale one", () => {
    const { getByTestId, rerender } = render(<Consumer file={fakeFile()} />);
    rerender(<Consumer file={null} />);
    expect(getByTestId("v").getAttribute("src")).toBe("");
  });
});
