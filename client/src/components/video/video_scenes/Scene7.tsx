import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video';

import careerImage1 from '@assets/careerconunseling_1773047158870.jpeg';
import careerImage2 from '@assets/importance-of-career-counselling_1773047158870.png';

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
      <div className="flex w-full h-full max-w-7xl mx-auto items-center px-8">
        <div className="w-1/2 relative h-full flex items-center justify-center overflow-hidden">
          
          <motion.div
            className="absolute w-[80%] h-[50vh] rounded-2xl overflow-hidden shadow-2xl rotate-[-5deg] z-10"
            initial={{ opacity: 0, x: -100, y: 50, rotate: -20 }}
            animate={{ opacity: 1, x: -20, y: 0, rotate: -5 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          >
            <img src={careerImage1} className="w-full h-full object-cover" />
          </motion.div>
          
          <motion.div
            className="absolute w-[70%] h-[40vh] rounded-2xl overflow-hidden shadow-2xl rotate-[10deg] z-20"
            initial={{ opacity: 0, x: -50, y: 100, rotate: 20 }}
            animate={{ opacity: 1, x: 40, y: 40, rotate: 10 }}
            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.3 }}
          >
            <img src={careerImage2} className="w-full h-full object-cover" />
          </motion.div>

        </div>

        <div className="w-1/2 pl-16">
          <motion.h2 
            className="text-6xl font-display font-bold text-primary mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            Guiding Futures
          </motion.h2>
          
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.8 }}
            className="h-2 w-24 bg-accent mb-8 origin-left"
          />

          <motion.p 
            className="text-4xl text-text-secondary leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            <span className="font-bold text-text-primary">Global Foresight</span> guides students with career counseling and higher education planning.
          </motion.p>
        </div>
      </div>
    </motion.div>
  );
}
