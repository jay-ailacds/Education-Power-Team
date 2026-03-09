import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video';
import schoolKids from '@assets/school_kids_1773047158872.webp';

export function Scene2() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 800),
      setTimeout(() => setStep(2), 2000),
      setTimeout(() => setStep(3), 3500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 bg-bg-light flex items-center justify-center overflow-hidden"
      {...sceneTransitions.wipe}
    >
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />

      {/* Blueprint animation lines */}
      <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1400 1000">
        <motion.path
          d="M 100,800 C 300,800 300,200 500,200 S 700,600 900,600"
          stroke="var(--color-primary)"
          strokeWidth="4"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />
        <motion.path
          d="M 500,200 C 700,200 700,800 900,800 S 1100,400 1300,400"
          stroke="var(--color-secondary)"
          strokeWidth="4"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2, ease: "easeInOut", delay: 0.5 }}
        />
      </svg>
      
      <div className="flex flex-row w-full h-full max-w-7xl mx-auto items-center justify-between px-16 relative z-10">
        
        {/* Left: Text Content */}
        <div className="w-1/2">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col gap-6"
          >
            <motion.h2 
              className="text-6xl font-display font-bold text-primary"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: step > 0 ? 1 : 0, y: step > 0 ? 0 : 20 }}
            >
              Building a Vision
            </motion.h2>
            <motion.p 
              className="text-3xl text-text-secondary leading-relaxed max-w-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: step > 1 ? 1 : 0 }}
            >
              Every educational institute begins with a vision. But building a future-ready institute today requires much more than infrastructure.
            </motion.p>
          </motion.div>
        </div>

        {/* Right: Images/Visuals */}
        <div className="w-1/2 relative h-[70vh] flex items-center justify-center">
           {/* Abstract Building block */}
          <motion.div 
            className="absolute w-64 h-80 bg-secondary/10 border-2 border-secondary rounded-2xl -z-10"
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 10 }}
            transition={{ type: "spring", delay: 0.3 }}
          />
          <motion.div 
            className="absolute w-72 h-96 bg-primary/10 border-2 border-primary rounded-2xl -z-10"
            initial={{ scale: 0, rotate: 10 }}
            animate={{ scale: 1, rotate: -5 }}
            transition={{ type: "spring", delay: 0.5 }}
          />
          
          {step > 2 && (
            <motion.div
              className="absolute w-[110%] h-[110%] rounded-3xl overflow-hidden shadow-2xl"
              initial={{ opacity: 0, scale: 0.8, filter: 'blur(20px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              transition={{ duration: 1, ease: "circOut" }}
            >
              <img 
                src={schoolKids} 
                alt="Students" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-primary/20 mix-blend-overlay" />
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
