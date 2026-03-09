import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions, staggerConfigs, itemVariants, containerVariants } from '@/lib/video';
import computerLabs from '@assets/computerlabs_1773047158875.jpg';
import sportsAcademy from '@assets/sports_academy_1773047158873.jpeg';

export function Scene3() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 500),
      setTimeout(() => setStep(2), 2000),
      setTimeout(() => setStep(3), 3500),
      setTimeout(() => setStep(4), 4500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 bg-bg-dark text-text-inverse flex flex-col items-center justify-center overflow-hidden"
      {...sceneTransitions.morphExpand}
    >
      {/* Dynamic Background */}
      <motion.div 
        className="absolute inset-0 opacity-40 bg-gradient-to-br from-primary via-bg-dark to-secondary"
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%'],
        }}
        transition={{ duration: 10, ease: 'linear', repeat: Infinity, repeatType: 'reverse' }}
        style={{ backgroundSize: '200% 200%' }}
      />

      <div className="z-10 w-full px-16 max-w-7xl">
        <motion.h2 
          className="text-5xl md:text-6xl font-display font-bold text-center mb-16"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          It requires <span className="text-accent">more</span>...
        </motion.h2>

        <div className="grid grid-cols-2 gap-10">
          
          <motion.div 
            className="relative h-[40vh] rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(59,130,246,0.3)]"
            initial={{ opacity: 0, x: -50, scale: 0.9 }}
            animate={{ opacity: step > 0 ? 1 : 0, x: step > 0 ? 0 : -50, scale: step > 0 ? 1 : 0.9 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          >
            <img src={computerLabs} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-8">
              <h3 className="text-3xl font-bold">Advanced Technology</h3>
            </div>
          </motion.div>

          <motion.div 
            className="relative h-[40vh] rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(245,158,11,0.3)]"
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: step > 1 ? 1 : 0, x: step > 1 ? 0 : 50, scale: step > 1 ? 1 : 0.9 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          >
            <img src={sportsAcademy} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-8">
              <h3 className="text-3xl font-bold">Structured Sports</h3>
            </div>
          </motion.div>
        </div>

        {step > 3 && (
          <motion.div 
            className="absolute bottom-10 left-0 w-full flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-2xl font-body text-center max-w-3xl text-bg-muted/80">
              Smart classrooms, efficient administration, and future-ready skills.
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
