type PixelFoodMarkProps = {
  readonly className?: string;
  readonly title?: string;
  readonly withEyes?: boolean;
  readonly animated?: boolean;
};

export function PixelFoodMark({ className, title, withEyes, animated }: PixelFoodMarkProps) {
  const labelled = Boolean(title);

  return (
    <svg
      viewBox="0 0 16 16"
      role={labelled ? "img" : undefined}
      aria-hidden={labelled ? undefined : true}
      aria-label={title}
      className={className}
      shapeRendering="crispEdges"
    >
      {/* Humito: estático a la izquierda, varias líneas animadas en login */}
      {animated ? (
        <>
          <g className="frig-smoke frig-smoke-1">
            <path d="M7 0h2v3H7z" fill="currentColor" opacity=".9" />
            <path d="M7 3h1v1H7z" fill="currentColor" opacity=".5" />
          </g>
          <g className="frig-smoke frig-smoke-2">
            <path d="M4 1h1v2H4z" fill="currentColor" opacity=".55" />
            <path d="M4 3h1v1H4z" fill="currentColor" opacity=".3" />
          </g>
          <g className="frig-smoke frig-smoke-3">
            <path d="M11 1h1v2h-1z" fill="currentColor" opacity=".5" />
            <path d="M11 3h1v1h-1z" fill="currentColor" opacity=".28" />
          </g>
        </>
      ) : (
        <path d="M3 2h2v2H3zM7 1h2v3H7zM11 2h2v2h-2z" fill="currentColor" opacity=".72" />
      )}
      <path d="M2 5h12v2H2zM3 7h10v4H3zM5 11h6v2H5zM6 13h4v2H6z" fill="currentColor" />
      {withEyes ? (
        <g>
          <rect x="6" y="8" width="1" height="1" fill="#0f2e1c" className="frig-eye" />
          <rect x="9" y="8" width="1" height="1" fill="#0f2e1c" className="frig-eye" />
        </g>
      ) : (
        <path
          d="M5 7h2v2H5zM9 7h2v2H9z"
          fill="var(--frig-bg, var(--brand-foreground))"
        />
      )}
    </svg>
  );
}
