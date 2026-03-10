import { AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { 
  Scene1, Scene2, Scene3, Scene4, 
  Scene5, Scene6, Scene7, Scene8 
} from './video_scenes';

export const SCENE_DURATIONS = {
  scene1: 3000,
  scene2: 7000,
  scene3: 6000,
  scene4: 4000,
  scene5: 18000, // 4 services * ~4-4.5s
  scene6: 14000, // 4 operations
  scene7: 4000,
  scene8: 4000,
};

// Per-segment durations for isolated capture
// Scene5: carousel cycles 4 services × 4.5s each = 18s total
// Scene6: 4 operations appearing sequentially over 14s
export const SEGMENT_DURATIONS: Record<number, Record<number, number>> = {
  5: { 1: 4500, 2: 4500, 3: 4500, 4: 4500 },
  6: { 1: 3500, 2: 3500, 3: 3500, 4: 3500 },
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({
    durations: SCENE_DURATIONS,
  });

  return (
    <div
      className="w-full h-screen overflow-hidden relative"
      style={{ backgroundColor: 'var(--color-bg-light)' }}
    >
      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="scene1" />}
        {currentScene === 1 && <Scene2 key="scene2" />}
        {currentScene === 2 && <Scene3 key="scene3" />}
        {currentScene === 3 && <Scene4 key="scene4" />}
        {currentScene === 4 && <Scene5 key="scene5" />}
        {currentScene === 5 && <Scene6 key="scene6" />}
        {currentScene === 6 && <Scene7 key="scene7" />}
        {currentScene === 7 && <Scene8 key="scene8" />}
      </AnimatePresence>
    </div>
  );
}
