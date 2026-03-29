import { useEffect, useState } from "react";

/**
 * Returns the current on-screen keyboard height in pixels.
 * Uses the visualViewport API to detect when the keyboard
 * shrinks the visible area.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // keyboard height = full window height - visible viewport height - viewport offset
      const kbh = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setHeight(Math.round(kbh));
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return height;
}
