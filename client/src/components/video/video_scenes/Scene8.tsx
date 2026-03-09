import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video';
import campusImage from '@assets/campus_ecosystem.png';

export function Scene8() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 800),
      setTimeout(() => setStep(2), 2000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      {...sceneTransitions.zoomThrough}
    >
      {/* Campus background image */}
      <motion.div 
        className="absolute inset-0"
        initial={{ scale: 1.1, filter: 'brightness(0.6)' }}
        animate={{ scale: 1, filter: 'brightness(0.5)' }}
        transition={{ duration: 3 }}
      >
        <img src={campusImage} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/60 via-primary/70 to-primary/90" />
      </motion.div>

      {/* Rotating ecosystem circles */}
      <svg className="absolute inset-0 w-full h-full opacity-20">
        <motion.circle cx="50%" cy="50%" r="400" stroke="white" strokeWidth="2" fill="none" strokeDasharray="20 20" 
          animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: 'center' }} />
        <motion.circle cx="50%" cy="50%" r="300" stroke="white" strokeWidth="1.5" fill="none" strokeDasharray="15 15" 
          animate={{ rotate: -360 }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: 'center' }} />
      </svg>

      <div className="z-10 flex flex-col items-center text-center max-w-[90vw] px-[5vw]">
        <motion.div
          initial={{ scale: 0, y: -50, rotate: -180 }}
          animate={{ scale: 1, y: 0, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="bg-accent rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(245,158,11,0.8)]"
          style={{ width: 'clamp(4rem, 8vw, 8rem)', height: 'clamp(4rem, 8vw, 8rem)' }}
        >
          <span className="text-primary font-display font-black" style={{ fontSize: 'clamp(1.5rem, 4vw, 3rem)' }}>EP</span>
        </motion.div>

        <motion.h1 
          className="font-display font-bold text-text-inverse tracking-tight mb-6"
          style={{ fontSize: 'clamp(2rem, 10vw, 5rem)' }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          Education <span className="text-accent">Power Team</span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: 0.8 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 max-w-[80vw]"
        >
          <h2 className="text-text-inverse font-medium" style={{ fontSize: 'clamp(1rem, 2.5vw, 1.75rem)' }}>Complete 360° Solution for Educational Institutes</h2>
        </motion.div>
        
        {step > 1 && (
          <motion.p
            className="mt-12 text-text-inverse/90 font-body max-w-[75vw]"
            style={{ fontSize: 'clamp(0.875rem, 2.2vw, 1.5rem)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            One powerful ecosystem for building the future of education.
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
