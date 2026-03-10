import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video';

import vardhmanImage from '@assets/vardhman_classroom.png';
import batteryImage from '@assets/Batteris_1773047158874.webp';
import computerLabImage from '@assets/computerlabs_1773047158875.jpg';
import sportsImage from '@assets/sports_academy_1773047158873.jpeg';

const services = [
  { name: 'Vardhman Traders', desc: 'Modern Classroom Infrastructure', image: vardhmanImage },
  { name: 'Mega Byte Systems', desc: 'Advanced IT Systems', image: computerLabImage },
  { name: 'Ace Power', desc: 'Reliable Power Backup', image: batteryImage },
  { name: 'Athletos Foundation', desc: 'Structured Sports', image: sportsImage },
];

interface Scene5Props {
  segment?: number; // 1-based: 1=Vardhman, 2=MegaByte, 3=AcePower, 4=Athletos
}

export function Scene5({ segment }: Scene5Props) {
  const [activeIdx, setActiveIdx] = useState(segment ? segment - 1 : 0);

  useEffect(() => {
    // If rendering a single segment, don't cycle
    if (segment) return;

    const interval = setInterval(() => {
      setActiveIdx(prev => (prev < 3 ? prev + 1 : 0));
    }, 4000);

    return () => clearInterval(interval);
  }, [segment]);

  return (
    <motion.div
      className="absolute inset-0 bg-bg-light flex flex-col items-center justify-center overflow-hidden"
      {...sceneTransitions.slideLeft}
    >
      <div className="absolute inset-0 bg-grid-pattern opacity-20" />

      <motion.h2 
        className="absolute top-16 font-display font-bold text-primary z-20"
        style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Infrastructure & <span className="text-accent">Technology</span>
      </motion.h2>

      <div className="relative w-full h-[60vh] max-w-7xl mx-auto flex items-center justify-center mt-20">
        
        {services.map((svc, idx) => (
          activeIdx === idx && (
            <motion.div
              key={idx}
              className="absolute flex flex-col items-center w-full"
              initial={{ opacity: 0, scale: 0.8, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
              transition={{ duration: 0.8, ease: "circOut" }}
            >
              <div className="w-[70vw] h-[45vh] rounded-3xl overflow-hidden shadow-2xl relative mb-8">
                <img src={svc.image} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                
                <div className="absolute bottom-10 left-10 text-white">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                    className="h-2 bg-accent mb-4"
                  />
                  <motion.h3 
                    className="font-display font-bold drop-shadow-lg"
                    style={{ fontSize: 'clamp(1.5rem, 5vw, 3.5rem)' }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    {svc.name}
                  </motion.h3>
                  <motion.p 
                    className="text-white/90 mt-2 font-body"
                    style={{ fontSize: 'clamp(1rem, 2.5vw, 1.75rem)' }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                  >
                    {svc.desc}
                  </motion.p>
                </div>
              </div>
            </motion.div>
          )
        ))}
      </div>

      {/* Progress dots */}
      <div className="absolute bottom-12 flex gap-4 z-20">
        {services.map((_, idx) => (
          <div 
            key={idx} 
            className={`h-3 rounded-full transition-all duration-500 ${activeIdx === idx ? 'w-12 bg-accent' : 'w-3 bg-text-muted/30'}`}
          />
        ))}
      </div>

    </motion.div>
  );
}
