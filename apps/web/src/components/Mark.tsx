/**
 * PandorIA's mark: a box with its lid ajar and light escaping through the gap, what's already out. Below 40 px the rays
 * are dropped, as in the browser tab's icon, where they'd only blur. Decoration: the name beside it says the rest.
 */
export const Mark = ({ size, className }: { size: number; className?: string }) => (
  <svg
    aria-hidden="true"
    width={size}
    height={size}
    viewBox="0 0 120 120"
    className={className}
    focusable="false"
  >
    {size >= 40 ? (
      <g fill="#FF9416" opacity="0.5">
        <polygon points="96,52 120,42 120,50" />
        <polygon points="96,48 115,20 120,27" />
        <polygon points="94,46 103,3 111,6" />
      </g>
    ) : null}
    <polygon points="24,60 96,60 96,43 24,58" fill="#FF9416" />
    <rect x="24" y="60" width="72" height="44" rx="5" fill="#E2E8F0" />
    <rect x="24" y="60" width="72" height="7" fill="#CBD5E1" />
    <polygon points="18,52 100,34 102,43 20,61" fill="#F8FAFC" />
  </svg>
);
