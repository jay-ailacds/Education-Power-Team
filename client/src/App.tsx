import VideoTemplate, { SCENE_DURATIONS, SEGMENT_DURATIONS } from "@/components/video/VideoTemplate";
import { useVideoPlayer } from "@/lib/video/hooks";
import {
  Scene1, Scene2, Scene3, Scene4,
  Scene5, Scene6, Scene7, Scene8,
} from "@/components/video/video_scenes";

const SCENE_COMPONENTS = [Scene1, Scene2, Scene3, Scene4, Scene5, Scene6, Scene7, Scene8];

function IsolatedScene({ index, segment }: { index: number; segment?: number }) {
  const SceneComponent = SCENE_COMPONENTS[index];
  const sceneKeys = Object.keys(SCENE_DURATIONS);
  const sceneKey = sceneKeys[index];
  const sceneNumber = index + 1;

  // Determine duration: use segment duration if capturing a segment, else full scene duration
  let duration: number;
  if (segment && SEGMENT_DURATIONS[sceneNumber]?.[segment]) {
    duration = SEGMENT_DURATIONS[sceneNumber][segment];
  } else {
    duration = Object.values(SCENE_DURATIONS)[index];
  }

  // Create a single-scene durations map for the hook
  const durationKey = segment ? `${sceneKey}_seg${segment}` : sceneKey;
  const singleDurations = { [durationKey]: duration };

  useVideoPlayer({
    durations: singleDurations,
    loop: false,
  });

  // Only Scene5 and Scene6 accept the segment prop
  const sceneProps = (sceneNumber === 5 || sceneNumber === 6) && segment
    ? { segment }
    : {};

  return (
    <div className="w-full h-screen overflow-hidden relative" style={{ backgroundColor: 'var(--color-bg-light)' }}>
      <SceneComponent {...sceneProps} />
    </div>
  );
}

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const sceneParam = params.get("scene");
  const segmentParam = params.get("segment");

  if (sceneParam) {
    const sceneIndex = parseInt(sceneParam, 10) - 1;
    if (sceneIndex >= 0 && sceneIndex < SCENE_COMPONENTS.length) {
      const segmentNum = segmentParam ? parseInt(segmentParam, 10) : undefined;
      return <IsolatedScene index={sceneIndex} segment={segmentNum} />;
    }
  }

  return <VideoTemplate />;
}
