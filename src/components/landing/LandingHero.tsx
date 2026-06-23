import { motion, AnimatePresence } from 'framer-motion';
import { HeroSingularity } from '../home/hero-singularity/HeroSingularity';
import { HeroElementDistortionProvider, useSingularity } from '../home/hero-singularity/HeroElementDistortionProvider';
import { ArrowRight, Network } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useThemeStore } from '@/stores/theme-store';

// Internal helper: hero elements that subtly react when the singularity emits a wave
const ReactiveElement = ({ children, className, delay = 0, style = {} }: any) => {
  const { waveCount, isEmitting } = useSingularity();

  return (
    <motion.div
      data-singularity-reactive="true"
      className={className}
      style={style}
      // Re-key each wave emission so the animation always fires fresh
      key={`reactive-${waveCount}`}
      animate={isEmitting ? {
        y: [0, -1.5, 1, 0],
        x: [0, 1, -0.5, 0],
        skewX: [0, 0.45, -0.2, 0],
        filter: [
          'blur(0px) brightness(1)',
          'blur(0.8px) brightness(1.06)',
          'blur(0.3px) brightness(1.02)',
          'blur(0px) brightness(1)',
        ],
        opacity: [1, 0.94, 0.98, 1],
      } : { y: 0, x: 0, skewX: 0, filter: 'blur(0px) brightness(1)', opacity: 1 }}
      transition={{
        duration: 1.8,
        delay: delay,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  );
};

export const LandingHero = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isLight = useThemeStore((s) => s.theme === 'light');
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredLogo, setHoveredLogo] = useState<string | null>(null);

  const institutions = [
    {
      name: 'IIT Guwahati',
      logo: '/logos/institutions/iit-guwahati.png',
      title: 'IIT Guwahati',
      description: 'Premier institute of technology and research known for innovation, entrepreneurship, and advanced engineering education.',
      tag: 'Research Partner',
      buttonText: 'Visit Website',
      link: 'https://www.iitg.ac.in',
    },
    {
      name: 'IIT Madras',
      logo: '/logos/institutions/iit-madras.png',
      title: 'IIT Madras',
      description: 'One of India\'s leading institutes driving technological innovation, deep research, and startup development.',
      tag: 'Innovation Partner',
      buttonText: 'Visit Website',
      link: 'https://www.iitm.ac.in',
    },
    {
      name: 'PSG College of Technology',
      logo: '/logos/institutions/psg-tech.png',
      title: 'PSG College of Technology',
      description: 'Renowned engineering institution recognized for academic excellence, industry collaboration, and technical leadership.',
      tag: 'Academic Partner',
      buttonText: 'Visit Website',
      link: 'https://www.psgtech.edu',
    },
  ];

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <HeroElementDistortionProvider>
      <section className="relative min-h-[min(90svh,_600px)] flex items-center pt-20 md:pt-0 overflow-x-hidden">
        {/* Mouse Follow Glow - Refined for "Scientific Command Center" vibe in light mode */}
        <motion.div
          className="fixed inset-0 z-0 pointer-events-none"
          animate={{
            background: isLight
              ? `radial-gradient(900px circle at ${mousePos.x}px ${mousePos.y}px, rgba(186, 230, 253, 0.22), transparent 50%), 
               radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.5), transparent 40%)`
              : `radial-gradient(800px circle at ${mousePos.x}px ${mousePos.y}px, rgba(111, 168, 255, 0.12), transparent 40%)`,
            opacity: isLight ? 1 : 0.6
          }}
        />

        {/* Background Ambience & Depth System */}
        <div className="absolute inset-0 z-0">
          {/* Layered Atmospheric Gradients */}
          <div className={`absolute top-[5%] left-[10%] w-[50vw] h-[50vw] blur-[140px] rounded-full animate-pulse transition-opacity duration-1000 ${isLight ? 'bg-steami-cyan/20 opacity-80' : 'bg-steami-cyan/10'}`} />
          <div className={`absolute bottom-[5%] right-[10%] w-[40vw] h-[40vw] blur-[140px] rounded-full transition-opacity duration-1000 ${isLight ? 'bg-steami-gold/15 opacity-60' : 'bg-steami-gold/5'}`} />

          {/* Scientific Mesh Overlay for Light Mode */}
          {isLight && (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(#005CC2_0.5px,transparent_0.5px)] [background-size:32px_32px] opacity-[0.03]" />
              <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-white/60 pointer-events-none" />
            </>
          )}
        </div>

        <div className="container relative z-10 mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center py-8 lg:py-0">
          {/* Left Side: Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col items-start text-left"
          >
            <ReactiveElement delay={0.2}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-2 mb-6"
              >
                <span className={`w-8 h-[1px] ${isLight ? 'bg-steami-cyan/40 shadow-[0_0_8px_rgba(0,92,194,0.2)]' : 'bg-steami-cyan/50'}`} />
                <span className={`steami-label tracking-[0.3em] ${isLight ? 'text-steami-cyan font-semibold' : 'text-steami-cyan'}`}>Next-Gen Intelligence</span>
              </motion.div>
            </ReactiveElement>

            <ReactiveElement delay={0.4}>
              <h1 className={`steami-heading text-4xl md:text-6xl lg:text-7xl mb-8 leading-[1.1] tracking-tight ${isLight ? 'text-zinc-900 drop-shadow-sm' : 'text-white'}`}>
                Mapping the <span className={`text-transparent bg-clip-text bg-gradient-to-r ${isLight ? 'from-steami-cyan via-steami-cyan to-steami-gold drop-shadow-none' : 'from-steami-cyan via-white to-steami-gold'}`}>Future</span> of Science & Technology
              </h1>
            </ReactiveElement>

            <ReactiveElement delay={0.6}>
              <p className={`text-lg md:text-xl max-w-xl mb-10 leading-relaxed font-medium ${isLight ? 'text-zinc-700' : 'text-white/70'}`}>
                STEAMI transforms research, emerging signals, and scientific discoveries into structured intelligence through interactive explainers, AI synthesis, and knowledge mapping.
              </p>
            </ReactiveElement>

            <div className="flex flex-wrap gap-5">
              <ReactiveElement delay={0.8}>
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: isLight ? "0 20px 40px rgba(0, 92, 194, 0.15), 0 0 10px rgba(0, 92, 194, 0.08)" : "0 0 30px rgba(111,168,255,0.4)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { if (location.pathname !== '/explore') navigate('/explore'); }}
                  className={`steami-btn py-4 px-8 flex items-center gap-3 group transition-all duration-300 ${isLight ? 'bg-white border-steami-cyan/40 text-steami-cyan shadow-lg hover:border-steami-cyan' : 'bg-steami-cyan/25 border-steami-cyan/50 text-steami-cyan hover:bg-steami-cyan/35'}`}
                >
                  EXPLORE INTELLIGENCE
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </motion.button>
              </ReactiveElement>

              <ReactiveElement delay={0.9}>
                <motion.button
                  whileHover={{ scale: 1.05, backgroundColor: isLight ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.1)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { if (location.pathname !== '/dashboard') navigate('/dashboard'); }}
                  className={`steami-btn py-4 px-8 flex items-center gap-3 transition-all duration-300 ${isLight ? 'bg-zinc-200/60 text-zinc-900 border-zinc-400/40 shadow-md hover:shadow-lg' : 'bg-white/5 border-white/20 text-white hover:bg-white/10'}`}
                >
                  KNOWLEDGE MAPS
                  <Network className="w-4 h-4" />
                </motion.button>
              </ReactiveElement>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 1 }}
              className={`mt-16 flex items-center gap-6 transition-all cursor-default ${isLight ? 'opacity-100' : 'opacity-90 hover:opacity-100'}`}
            >
              <span className={`font-mono text-[10px] uppercase tracking-widest ${isLight ? 'text-zinc-500 font-bold' : 'text-white/60'}`}>Trusted by Pioneers</span>
              <div className={`w-px h-4 ${isLight ? 'bg-zinc-400' : 'bg-white/30'}`} />
              <div className="flex items-center gap-8">
                {institutions.map((inst) => {
                  const isHovered = hoveredLogo === inst.name;
                  return (
                    <div
                      key={inst.name}
                      className="relative flex items-center justify-center"
                      onMouseEnter={() => {
                        console.log("LOGO_HOVER_ENTER:", inst.name);
                        setHoveredLogo(inst.name);
                      }}
                      onMouseLeave={() => {
                        console.log("LOGO_HOVER_LEAVE:", inst.name);
                        setHoveredLogo(null);
                      }}
                    >
                      {/* Adaptive Background Halo */}
                      <div
                        className="absolute pointer-events-none -inset-3 select-none"
                        style={{
                          background: isLight
                            ? 'radial-gradient(circle, rgba(0,0,0,0.04), transparent 70%)'
                            : 'radial-gradient(circle, rgba(255,255,255,0.05), transparent 70%)',
                          zIndex: 0,
                        }}
                      />

                      {/* The Logo */}
                      <motion.div
                        animate={{
                          scale: isHovered ? 1.15 : 1,
                          filter: isHovered
                            ? isLight
                              ? 'brightness(1.05) contrast(1.3) saturate(1.05) drop-shadow(0 4px 12px rgba(0,0,0,0.08)) drop-shadow(0 0 8px rgba(0,0,0,0.05))'
                              : 'brightness(1.22) contrast(1.18) saturate(1.08) drop-shadow(0 6px 16px rgba(255,255,255,0.12)) drop-shadow(0 0 8px rgba(255,255,255,0.08))'
                            : isLight
                              ? 'brightness(1.02) contrast(1.25) saturate(1.0) drop-shadow(0 4px 12px rgba(0,0,0,0.08)) drop-shadow(0 0 8px rgba(0,0,0,0.05))'
                              : 'brightness(1.15) contrast(1.15) saturate(1.0) drop-shadow(0 6px 16px rgba(255,255,255,0.12)) drop-shadow(0 0 8px rgba(255,255,255,0.08))',
                          opacity: 1
                        }}
                        className="relative z-10 cursor-pointer transition-all duration-300 flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-steami-cyan dark:hover:text-steami-cyan"
                        style={{ height: '44px', width: 'auto' }}
                      >
                        <img
                          src={inst.logo}
                          alt={inst.name}
                          className="h-11 w-auto max-w-full object-contain"
                          style={{ objectFit: 'contain' }}
                        />
                      </motion.div>

                      {/* The Popup */}
                      <AnimatePresence>
                        {isHovered && (
                          <motion.div
                            initial={{ opacity: 0, y: 15, x: "-50%" }}
                            animate={{ opacity: 1, y: 0, x: "-50%" }}
                            exit={{ opacity: 0, y: 10, x: "-50%" }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="absolute bottom-full left-1/2 mb-4 w-72 p-5 glass-card z-50 text-left cursor-default shadow-2xl flex flex-col gap-3"
                            style={{
                              pointerEvents: 'auto',
                              boxShadow: isLight
                                ? '0 10px 30px rgba(0, 92, 194, 0.1), 0 1px 3px rgba(0, 0, 0, 0.05)'
                                : '0 10px 30px rgba(111, 168, 255, 0.1), 0 0 12px rgba(0, 0, 0, 0.5)',
                              borderColor: isLight ? 'rgba(0, 92, 194, 0.2)' : 'rgba(111, 168, 255, 0.15)',
                              borderRadius: '16px',
                              backdropFilter: 'blur(20px) saturate(140%)'
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`steami-label font-bold text-[10px] tracking-wider truncate`}>
                                {inst.name}
                              </span>
                              <span className={`steami-badge text-[8px] whitespace-nowrap ${inst.tag === 'Research Partner'
                                ? 'steami-badge-cyan'
                                : inst.tag === 'Innovation Partner'
                                  ? 'steami-badge-gold'
                                  : 'steami-badge-green'
                                }`}>
                                {inst.tag}
                              </span>
                            </div>

                            <p className={`text-xs leading-relaxed font-normal ${isLight ? 'text-zinc-600' : 'text-white/75'}`}>
                              {inst.description}
                            </p>

                            <a
                              href={inst.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 w-full"
                            >
                              <motion.button
                                whileHover={{ scale: 1.02, backgroundColor: isLight ? '#005cc2' : 'rgba(111,168,255,0.45)' }}
                                whileTap={{ scale: 0.98 }}
                                className={`w-full py-2 px-3 text-[10px] font-semibold text-center tracking-widest rounded-lg flex items-center justify-center gap-1.5 transition-all duration-200 uppercase ${isLight
                                  ? 'bg-steami-cyan-hex text-white hover:bg-[#005cc2] border border-transparent'
                                  : 'bg-steami-cyan/25 text-steami-cyan hover:bg-steami-cyan/35 border border-steami-cyan/30'
                                  }`}
                              >
                                {inst.buttonText}
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                  <path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" />
                                </svg>
                              </motion.button>
                            </a>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>

          {/* Right Side: Visual
              BUG FIX: min-h-[400px] on all breakpoints caused the canvas to
              consume the full viewport height on landscape phones (~430 px
              tall), with no way to scroll. Now responsive:
                mobile (<md)  → 280px
                tablet (md)   → 380px
                desktop (≥lg) → 520px
                xl            → 600px
              overflow-hidden replaces overflow:visible so floating labels
              are clipped and don't cause horizontal bleed.
          */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
            className="relative flex items-center justify-center w-full
                       min-h-[280px]
                       md:min-h-[380px]
                       lg:min-h-[520px]
                       xl:min-h-[600px]
                       overflow-hidden"
          >
            <HeroSingularity />

            {/* Subtle Floating Labels - Enhanced for light theme with reaction */}
            <ReactiveElement delay={1.2} className="absolute top-[20%] right-0">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className={`glass-card p-3 px-4 text-[10px] font-mono tracking-wider text-steami-cyan flex items-center gap-2 ${isLight ? 'shadow-xl border-white/80 bg-white/70 backdrop-blur-md' : ''}`}
              >
                <div className={`w-1.5 h-1.5 bg-steami-cyan rounded-full animate-pulse ${isLight ? 'shadow-[0_0_8px_rgba(0,92,194,0.5)]' : ''}`} />
                LIVE SIGNAL DETECTION
              </motion.div>
            </ReactiveElement>

            <ReactiveElement delay={1.4} className="absolute bottom-[20%] left-0">
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className={`glass-card p-3 px-4 text-[10px] font-mono tracking-wider text-steami-gold flex items-center gap-2 ${isLight ? 'shadow-xl border-white/80 bg-white/70 backdrop-blur-md' : ''}`}
              >
                <div className={`w-1.5 h-1.5 bg-steami-gold rounded-full animate-pulse ${isLight ? 'shadow-[0_0_8px_rgba(138,112,32,0.5)]' : ''}`} />
                NEURAL MAPPING ACTIVE
              </motion.div>
            </ReactiveElement>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className={`font-mono text-[9px] uppercase tracking-[0.3em] ${isLight ? 'text-zinc-600 font-medium' : 'text-muted-foreground'}`}>Scroll to explore</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`w-[1px] h-12 bg-gradient-to-b from-steami-cyan to-transparent ${isLight ? 'opacity-70' : ''}`}
          />
        </motion.div>
      </section>
    </HeroElementDistortionProvider>
  );
};
