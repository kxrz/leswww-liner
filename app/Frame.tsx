import { PANEL, VISIBLE } from "@/lib/frame";

// The picture is the full 800×480 panel; the mockup only shows what the mat leaves visible.
const visibleW = VISIBLE.x1 - VISIBLE.x0;
const visibleH = VISIBLE.y1 - VISIBLE.y0;
const crop = {
  width: `${(PANEL.width / visibleW) * 100}%`,
  left: `${(-VISIBLE.x0 / visibleW) * 100}%`,
  top: `${(-VISIBLE.y0 / visibleH) * 100}%`,
};

type Props = {
  src?: string;
  alt: string;
  /** Drives the waiting and flash animations of the control room. */
  state?: "waiting" | "flash";
  small?: boolean;
  /** The largest picture of the page: load it first. */
  priority?: boolean;
};

/** The physical frame: black wood, white mat, then the panel. */
export function Frame({ src, alt, state, small = false, priority = false }: Props) {
  return (
    <div className={small ? "frame small" : "frame"}>
      <div className="mat">
        <div className={state ? `screen ${state}` : "screen"} style={{ aspectRatio: `${visibleW} / ${visibleH}` }}>
          {src ? (
            <img
              src={src}
              alt={alt}
              style={crop}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : undefined}
              decoding="async"
            />
          ) : (
            <p className="empty">Nothing on the wall yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
