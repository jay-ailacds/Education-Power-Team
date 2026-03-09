import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { sceneTransitions } from '@/lib/video';

import tallyImage from '@assets/tally_1773047158873.jpg';
import medicalImage from '@assets/skillbasedmedical_1773047158871.webp';
import aiImage from '@assets/AI_1773047158871.webp';
import rootSquareImage from '@assets/root_square_students.png';

const operations = [
  { name: 'A.K. Solutions', desc: 'ERP & Automation', img: tallyImage, color: 'border-blue-500' },
  { name: 'Root Square LLP', desc: 'Uniforms & Stationery', img: rootSquareImage, color: 'border-green-500' },
  { name: 'AI-LAC-DS', desc: 'AI Learning Programs', img: aiImage, color: 'border-purple-500' },
  { name: 'Asperia Institute', desc: 'Medical Skill Training', img: medicalImage, color: 'border-red-500' },
];

export function Scene6() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 500),
      setTimeout(() => setStep(2), 3500),
      setTimeout(() => setStep(3), 7000),
      setTimeout(() => setStep(4), 10500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      className="absolute inset-0 bg-bg-dark text-text-inverse overflow-hidden"
      {...sceneTransitions.scaleFade}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--color-primary)_0%,_var(--color-bg-dark)_70%)] opacity-30" />
      
      <div className="w-full h-full flex flex-col items-center pt-20 pb-10 px-16 relative z-10">
        <motion.h2 
          className="text-5xl font-display font-bold text-center mb-16"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Operations & <span className="text-accent">Future Skills</span>
        </motion.h2>

        <div className="w-full max-w-6xl relative h-[65vh]">
          {operations.map((op, idx) => (
            step === idx + 1 && (
              <motion.div
                key={idx}
                className={`absolute inset-0 flex items-center justify-between bg-bg-dark/50 backdrop-blur-xl rounded-3xl border-2 ${op.color} p-12`}
                initial={{ opacity: 0, scale: 0.9, rotateX: -20 }}
                animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
              >
                <div className="w-1/2 pr-12">
                  <motion.h3 
                    className="text-6xl font-display font-bold mb-6"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    {op.name}
                  </motion.h3>
                  <motion.p 
                    className="text-4xl text-text-muted"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    {op.desc}
                  </motion.p>
                </div>
                
                <div className="w-1/2 h-full flex items-center justify-center relative">
                  {op.img ? (
                    <motion.div
                      className="w-full h-full rounded-2xl overflow-hidden shadow-2xl"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4, type: "spring" }}
                    >
                      <img src={op.img} className="w-full h-full object-cover" />
                    </motion.div>
                  ) : null}
                </div>
              </motion.div>
            )
          ))}
        </div>
      </div>
    </motion.div>
  );
}
