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
          radial-gradient(ellipse at 18% 28%, rgba(98, 88, 72, 0.055) 0%, transparent 42%),
          radial-gradient(ellipse at 70% 60%, rgba(116, 103, 82, 0.045) 0%, transparent 46%),
          repeating-linear-gradient(7deg, rgba(92, 82, 67, 0.025) 0 1px, transparent 1px 9px),
          repeating-linear-gradient(96deg, rgba(255, 255, 255, 0.14) 0 1px, transparent 1px 13px),
          #eee7d8
        `,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.32,
          mixBlendMode: 'multiply',
          background: `
            repeating-radial-gradient(circle at 24% 31%, rgba(70, 62, 51, 0.022) 0 0.7px, transparent 0.7px 4px),
            repeating-radial-gradient(circle at 76% 62%, rgba(70, 62, 51, 0.018) 0 0.6px, transparent 0.6px 5px)
          `,
        }}
      />
    </div>
  )
}

export default SurfaceTextureLayer
