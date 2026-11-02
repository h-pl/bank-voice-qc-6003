/** Paint from the media clock, independently of React and the sparse timeupdate event. */
export function observeRecordingPosition(
  media: Pick<HTMLMediaElement, "currentTime" | "paused" | "ended" | "readyState" | "addEventListener" | "removeEventListener">,
  paint: (time: number) => void,
  frames = { request: (callback: FrameRequestCallback) => requestAnimationFrame(callback), cancel: (id: number) => cancelAnimationFrame(id) },
) {
  let frame: number | undefined;
  let disposed = false;
  const sync = () => paint(Number.isFinite(media.currentTime) ? media.currentTime : 0);
  const cancel = () => {
    if (frame !== undefined) frames.cancel(frame);
    frame = undefined;
  };
  const tick = () => {
    frame = undefined;
    if (disposed) return;
    sync();
    if (!media.paused && !media.ended && media.readyState >= 2) frame = frames.request(tick);
  };
  const start = () => {
    cancel();
    tick();
  };
  const stop = () => { cancel(); sync(); };
  const events: [string, () => void][] = [
    ["playing", start], ["seeked", start],
    ["pause", stop], ["ended", stop], ["waiting", stop], ["error", stop], ["emptied", stop],
    ["seeking", sync], ["loadedmetadata", sync], ["durationchange", sync], ["ratechange", sync], ["timeupdate", sync],
  ];
  events.forEach(([name, listener]) => media.addEventListener(name, listener));
  start();
  return () => {
    disposed = true;
    cancel();
    events.forEach(([name, listener]) => media.removeEventListener(name, listener));
  };
}
