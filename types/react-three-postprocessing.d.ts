// Type-only shim (tsc only; webpack still resolves the real package from node_modules).
// @react-three/postprocessing is pinned to 3.0.4: from 3.0.5 on, EffectComposer builds its composer asynchronously
// (useEffect + setState), so the single advance() that Remotion's ThreeCanvas (frameloop "never") makes per frame
// draws nothing and every still comes out as the empty background. 3.0.4 builds it synchronously (useMemo).
// 3.0.4 typed `children` as JSX.Element | JSX.Element[]; Bridge.tsx passes `cond ? <primitive/> : null`, which is
// fine at runtime, so `children` is widened to ReactNode here exactly as 3.0.5+ declares it.
import type { NamedExoticComponent, ReactNode, RefAttributes } from "react";
import type { EffectComposer as EffectComposerImpl } from "postprocessing";
import type { EffectComposerProps as Props304 } from "../node_modules/@react-three/postprocessing/dist/EffectComposer";
export * from "../node_modules/@react-three/postprocessing/dist/index";
export type EffectComposerProps = Omit<Props304, "children"> & { children?: ReactNode };
export declare const EffectComposer: NamedExoticComponent<EffectComposerProps & RefAttributes<EffectComposerImpl>>;
