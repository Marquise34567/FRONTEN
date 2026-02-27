const GlowBackdrop = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Primary glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        aria-hidden="true"
      >
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full opacity-20 blur-[120px] animate-pulse-glow"
          style={{ background: 'radial-gradient(circle, hsl(258 80% 60% / 0.6) 0%, hsl(220 90% 56% / 0.3) 50%, transparent 70%)' }}
        />
        <div className="absolute top-2/3 left-1/3 w-[400px] h-[400px] rounded-full opacity-10 blur-[100px]"
          style={{ background: 'radial-gradient(circle, hsl(258 60% 50% / 0.5) 0%, transparent 70%)' }}
        />
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full opacity-10 blur-[80px]"
          style={{ background: 'radial-gradient(circle, hsl(220 90% 56% / 0.4) 0%, transparent 70%)' }}
        />
      </div>
      {/* Vignette */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 50%, hsl(240 15% 5% / 0.8) 100%)' }}
        aria-hidden="true"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default GlowBackdrop;
