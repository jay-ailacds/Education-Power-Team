import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video';

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
      className="absolute inset-0 bg-primary flex items-center justify-center overflow-hidden"
      {...sceneTransitions.zoomThrough}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--color-secondary)_0%,_transparent_100%)] opacity-30" />
      
      {/* Ecosystem nodes connecting */}
      <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1200 800">
         <motion.circle cx="600" cy="400" r="300" stroke="white" strokeWidth="2" fill="none" strokeDasharray="10 10" 
           animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: '600px 400px' }} />
      </svg>

      <div className="z-10 flex flex-col items-center text-center max-w-5xl">
        <motion.div
          initial={{ scale: 0, y: -50 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="w-24 h-24 bg-accent rounded-2xl flex items-center justify-center mb-8 shadow-lg"
        >
          <span className="text-primary font-display font-black text-4xl">EP</span>
        </motion.div>

        <motion.h1 
          className="text-7xl md:text-8xl font-display font-bold text-text-inverse tracking-tight mb-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
        >
          Education <span className="text-accent">Power Team</span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20"
        >
           <h2 className="text-3xl text-text-inverse font-medium">Complete 360° Solution for Educational Institutes</h2>
        </motion.div>
        
        {step > 1 && (
          <motion.p
            className="mt-12 text-2xl text-text-inverse/80 font-body"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            One powerful ecosystem for building the future of education.
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}
