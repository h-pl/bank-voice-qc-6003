/** Native smooth scrolling can retarget and stays compatible with touch/trackpad input. */
export function revealTranscriptRow(row: Element | undefined) {
  row?.scrollIntoView({
    block: "nearest",
    inline: "nearest",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
  });
}
