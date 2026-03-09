import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video';

export function Scene4() {
  return (
    <motion.div
      className="absolute inset-0 bg-primary flex items-center justify-center overflow-hidden"
      {...sceneTransitions.clipCircle}
    >
      <div className="absolute inset-0 bg-grid-pattern-dark opacity-10" />

      {/* Pulsing rings */}
      <motion.div 
        className="absolute w-[80vw] h-[80vw] rounded-full border border-secondary/30"
        animate={{ scale: [1, 1.5], opacity: [0.8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />
      <motion.div 
        className="absolute w-[60vw] h-[60vw] rounded-full border border-secondary/50"
        animate={{ scale: [1, 1.5], opacity: [0.8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 1 }}
      />

      <div className="z-10 flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="w-32 h-32 bg-accent rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(245,158,11,0.5)]"
        >
          <span className="text-primary font-display font-black text-6xl">EP</span>
        </motion.div>
        
        <motion.h2 
          className="font-display font-medium text-text-inverse/80 mb-2"
          style={{ fontSize: 'clamp(1.5rem, 4vw, 3rem)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          Introducing the
        </motion.h2>

        <motion.h1 
          className="font-display font-bold text-text-inverse tracking-tight"
          style={{ fontSize: 'clamp(3rem, 10vw, 6rem)' }}
          initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: 0.8, duration: 0.8 }}
        >
          Education <span className="text-accent">Power Team</span>
        </motion.h1>

        <motion.div 
          className="mt-8 px-[5vw] py-3 bg-white/10 backdrop-blur-md rounded-full border border-white/20 max-w-[90vw]"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2, type: "spring" }}
        >
          <p className="text-text-inverse font-medium" style={{ fontSize: 'clamp(0.875rem, 2vw, 1.5rem)' }}>
            Complete 360° Solution for Educational Institutes
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
