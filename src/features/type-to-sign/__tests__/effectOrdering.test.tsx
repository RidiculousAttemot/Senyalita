import { describe, expect, it } from "vitest";
import { useEffect, useState, useRef } from "react";
import { render } from "@testing-library/react";

/**
 * Why the loader's "has it painted yet" flag is keyed rather than reset.
 *
 * React runs a child's effects before its parent's. A player that announces
 * its first frame from a mount effect therefore reports *before* a parent
 * effect keyed on the sequence can reset the flag — so the reset wins, the
 * flag stays false, and the loader never comes down. That is not a race; it
 * is the documented order, and it happens every time the child mounts in the
 * same commit the key changes.
 */

function Child({ onMounted }: { onMounted: () => void }) {
  useEffect(() => { onMounted(); }, [onMounted]);
  return null;
}

describe("effect ordering", () => {
  it("a child's mount effect beats the parent's reset, so a reset flag loses", () => {
    const order: string[] = [];

    function Parent({ seq }: { seq: number }) {
      useEffect(() => { order.push("parent-reset"); }, [seq]);
      return <Child onMounted={() => order.push("child-announce")} />;
    }

    render(<Parent seq={1} />);
    expect(order).toEqual(["child-announce", "parent-reset"]);
  });

  it("keying the flag to the sequence survives that order", () => {
    function Parent({ seq }: { seq: number }) {
      const [paintedKey, setPaintedKey] = useState<number | null>(null);
      const seqRef = useRef(seq);
      seqRef.current = seq;
      const painted = paintedKey === seq;
      return (
        <>
          <span data-testid="painted">{String(painted)}</span>
          <Child onMounted={() => setPaintedKey(seqRef.current)} />
        </>
      );
    }

    const { getByTestId } = render(<Parent seq={1} />);
    expect(getByTestId("painted").textContent).toBe("true");
  });
});
