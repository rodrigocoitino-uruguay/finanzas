interface CategoryAvatarProps {
  name?: string;
  color?: string;
  size?: number;
}

export function CategoryAvatar({ name, color = '#A3A3A3', size = 36 }: CategoryAvatarProps) {
  const initial = (name ?? '?').trim().charAt(0).toLocaleUpperCase('es') || '?';
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full text-[14px] font-medium"
      style={{
        width: size,
        height: size,
        color,
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 28%, transparent)`,
      }}
    >
      {initial}
    </span>
  );
}
