import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Minimum visible rows before the field starts growing. */
  minRows?: number;
  /** Maximum height in px before it scrolls instead of growing further. */
  maxHeight?: number;
};

/**
 * A textarea that grows in height to fit its content (one line per entered row)
 * and shrinks back when text is removed. Caps at `maxHeight` then scrolls.
 */
export default function AutoGrowTextarea({ minRows = 3, maxHeight, value, style, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const next = maxHeight ? Math.min(el.scrollHeight, maxHeight) : el.scrollHeight;
    el.style.height = `${next}px`;
    el.style.overflowY = maxHeight && el.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  // Re-fit whenever the controlled value changes (covers programmatic updates too).
  useLayoutEffect(resize, [value, maxHeight]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      onInput={resize}
      style={{ resize: "none", ...style }}
      {...rest}
    />
  );
}
