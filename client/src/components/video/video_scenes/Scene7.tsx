import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video';

import careerImage from '@assets/global_foresight_counseling.png';

export function Scene7() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 500),
      setTimeout(() => setStep(2), 2000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 bg-bg-muted flex items-center justify-center overflow-hidden"
      {...sceneTransitions.fadeBlur}
    >
      <div className="flex w-full h-full max-w-7xl mx-auto items-center px-12 gap-16">
        <motion.div
          className="w-1/2 h-[80vh] rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(30,58,138,0.3)]"
          initial={{ opacity: 0, scale: 0.85, filter: 'blur(20px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, ease: "circOut" }}
        >
          <img src={careerImage} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/20 via-transparent to-transparent pointer-events-none" />
        </motion.div>

        <div className="w-1/2">
          <motion.div
            className="flex items-start gap-4 mb-8"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="w-2 h-16 bg-accent rounded-full" />
            <div>
              <motion.h2 
                className="font-display font-bold text-primary leading-tight"
                style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                Guiding Futures
              </motion.h2>
            </div>
          </motion.div>

          <motion.p 
            className="text-text-secondary leading-relaxed mb-6"
            style={{ fontSize: 'clamp(1rem, 2.5vw, 1.5rem)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <span className="font-bold text-text-primary" style={{ fontSize: 'clamp(1.2rem, 2.8vw, 1.75rem)' }}>Global Foresight</span><br/>
            guides students with career counseling and higher education planning.
          </motion.p>

          {step > 1 && (
            <motion.div
              className="inline-block px-6 py-3 bg-accent/10 border-2 border-accent rounded-xl text-accent font-bold text-lg"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring" }}
            >
              One-on-one mentorship
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
