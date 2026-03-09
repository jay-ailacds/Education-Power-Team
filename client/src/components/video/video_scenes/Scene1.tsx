import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video';

export function Scene1() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 500),
      setTimeout(() => setStep(2), 1500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 bg-primary flex items-center justify-center overflow-hidden"
      {...sceneTransitions.fadeBlur}
    >
      {/* Background blueprint grid */}
      <motion.div 
        className="absolute inset-0 bg-grid-pattern-dark opacity-10"
        animate={{
          backgroundPosition: ['0px 0px', '40px 40px'],
        }}
        transition={{ duration: 3, ease: 'linear', repeat: Infinity }}
      />
      
      {/* Abstract land to campus transformation */}
      <motion.div 
        className="absolute bottom-0 w-full bg-secondary"
        initial={{ height: '0vh' }}
        animate={{ height: step > 0 ? '40vh' : '0vh' }}
        transition={{ duration: 1.5, ease: "circOut" }}
      />
      
      {step > 0 && (
        <motion.div 
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80vw] h-[30vh] bg-bg-light rounded-t-[50px] shadow-2xl"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.5 }}
        />
      )}

      {/* Main Text */}
      <div className="z-10 text-center px-[5vw] max-w-[90vw]">
        {step > 1 && (
          <motion.h1 
            className="font-display font-bold text-text-inverse leading-tight"
            style={{ fontSize: 'clamp(2rem, 8vw, 7rem)' }}
            initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, ease: "circOut" }}
          >
            Planning to build or upgrade an <span className="text-accent">educational institute?</span>
          </motion.h1>
        )}
      </div>
    </motion.div>
  );
}
