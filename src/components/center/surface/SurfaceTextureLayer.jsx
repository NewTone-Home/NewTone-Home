function SurfaceTextureLayer() {
  return (
    <div
      className="surface-texture-layer"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        background: `
          radial-gradient(ellipse at 20% 35%, rgba(200, 192, 175, 0.10) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 65%, rgba(210, 203, 188, 0.06) 0%, transparent 45%),
          rgba(237, 231, 218, 0.98)
        `,
      }}
    />
  )
}

export default SurfaceTextureLayer
