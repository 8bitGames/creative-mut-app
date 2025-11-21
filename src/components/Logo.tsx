interface LogoProps {
  className?: string;
  color?: 'black' | 'white';
}

export function Logo({ className = '', color = 'white' }: LogoProps) {
  return (
    <img
      src="/logo.jpg"
      alt="MUT Logo"
      className={className}
      style={{
        filter: color === 'black' ? 'invert(1)' : 'none',
        objectFit: 'contain',
      }}
    />
  );
}
