interface LogoProps {
  className?: string;
  color?: 'black' | 'white';
}

export function Logo({ className = '', color = 'white' }: LogoProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src="./logo.jpg"
        alt="MUT Logo"
        className="w-full h-full"
        style={{
          filter: color === 'black' ? 'invert(1)' : 'brightness(1.2)',
          objectFit: 'contain',
        }}
        onError={(e) => {
          console.error('❌ Failed to load logo image:', e);
          console.error('   Attempted to load from: /logo.jpg');
        }}
        onLoad={() => {
          console.log('✅ Logo image loaded successfully from /logo.jpg');
        }}
      />
    </div>
  );
}
