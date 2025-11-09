import React from 'react';

interface CommentIconProps {
  hasComment: boolean;
  onClick: () => void;
  title?: string;
}

export function CommentIcon({ hasComment, onClick, title = 'View documentation' }: CommentIconProps) {
  return (
    <button
      className={`comment-icon ${hasComment ? 'comment-icon--filled' : 'comment-icon--outline'}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      aria-label={hasComment ? 'View documentation' : 'No documentation'}
      type="button"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="8"
          cy="8"
          r="7"
          stroke="currentColor"
          strokeWidth="1.5"
          fill={hasComment ? 'currentColor' : 'none'}
        />
        <text
          x="8"
          y="8"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="10"
          fontWeight="bold"
          fill={hasComment ? 'var(--state-surface)' : 'currentColor'}
        >
          i
        </text>
      </svg>
    </button>
  );
}
