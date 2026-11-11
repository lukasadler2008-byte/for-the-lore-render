import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { PisaShort, PISA_FRAMES } from "./videos/pisa/Pisa";
import { DanceShort, DANCE_FRAMES } from "./videos/dance/Dance";
import { MicroShort, MICRO_FRAMES } from "./videos/micro/Micro";
import { MuskShort, MUSK_FRAMES } from "./videos/musk/Musk";
import { PizzaShort, PIZZA_FRAMES } from "./videos/pizza/Pizza";
import { TroyShort, TROY_FRAMES } from "./videos/troy/Troy";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="PisaShort" component={PisaShort} durationInFrames={PISA_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="DanceShort" component={DanceShort} durationInFrames={DANCE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="MicroShort" component={MicroShort} durationInFrames={MICRO_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="MuskShort" component={MuskShort} durationInFrames={MUSK_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="TroyShort" component={TroyShort} durationInFrames={TROY_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="PizzaShort" component={PizzaShort} durationInFrames={PIZZA_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
