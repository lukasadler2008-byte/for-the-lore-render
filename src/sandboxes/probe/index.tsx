// Debug entry: a minimal ThreeCanvas (lit red box) to check that WebGL frames reach the screenshot.
import React from "react";
import { Composition, registerRoot, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";

const Box: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <mesh rotation={[0.4, f * 0.05, 0]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="red" />
    </mesh>
  );
};
const Probe: React.FC = () => (
  <ThreeCanvas width={1080} height={1920} style={{ background: "#88aacc" }} camera={{ position: [0, 0, 6], fov: 40 }}>
    <ambientLight intensity={0.6} />
    <directionalLight position={[3, 5, 4]} intensity={2} />
    <Box />
  </ThreeCanvas>
);
const Root: React.FC = () => <Composition id="BridgeShort" component={Probe} durationInFrames={30} fps={30} width={1080} height={1920} />;
registerRoot(Root);
