/**
 * Shared JSX for every generated app icon (favicon, apple-icon, manifest
 * icons) so the home-screen icon actually matches the 8-ball mark used in
 * the site nav, at every size, from one definition. Solid felt-green
 * background fills the full square (not a transparent circle) so it still
 * looks right when Android/iOS crop it into their own icon shape.
 */
export function AppIconMark({ size }: { size: number }) {
  const ball = Math.round(size * 0.74);
  return (
    <div
      style={{
        width: size,
        height: size,
        background: "#0f1a14",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: ball,
          height: ball,
          borderRadius: "50%",
          background: "radial-gradient(circle at 35% 30%, #52525b 0%, #18181b 55%, #09090b 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: Math.round(ball * 0.46),
            height: Math.round(ball * 0.46),
            borderRadius: "50%",
            background: "#fafafa",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: Math.round(ball * 0.32),
              fontWeight: 800,
              fontFamily: "system-ui",
              color: "#09090b",
            }}
          >
            8
          </div>
        </div>
      </div>
    </div>
  );
}
