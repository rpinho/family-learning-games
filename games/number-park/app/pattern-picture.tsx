export function PatternPicture({
  piece,
  growing = false,
}: {
  piece: string;
  growing?: boolean;
}) {
  if (piece.includes(':'))
    return (
      <span className="pattern-picture">
        {piece.split(' ').map((token, i) => {
          const [shape, colour] = token.split(':'),
            fill = (
              { coral: '#cf6255', gold: '#d8a32d', teal: '#268c87' } as any
            )[colour];
          return (
            <svg
              key={i}
              viewBox="0 0 48 48"
              role="img"
              aria-label={`${colour} ${shape}`}
            >
              {shape === 'circle' ? (
                <circle cx="24" cy="24" r="18" fill={fill} />
              ) : (
                <rect x="6" y="6" width="36" height="36" rx="3" fill={fill} />
              )}
            </svg>
          );
        })}
      </span>
    );
  return (
    <span
      className={
        'pattern-picture' +
        (growing || Array.from(piece).length > 4 ? ' growing' : '')
      }
    >
      {piece}
    </span>
  );
}
