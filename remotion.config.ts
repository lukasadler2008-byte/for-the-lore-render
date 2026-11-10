import { Config } from "@remotion/cli/config";

// No GPU in this container: WebGL2 only works through ANGLE + SwiftShader ("swangle"); "swiftshader", "angle" and
// "egl" give no WebGL2 context. Keep bundles out of the system temp dir: export REMOTION_TMP/TEMP/TMP/TMPDIR.
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("swangle");
Config.setBrowserExecutable("/usr/bin/google-chrome");
// Building the world (Canvas2D painted textures + town) takes ~50-60 s per tab on SwiftShader: the 30 s default times out.
Config.setDelayRenderTimeoutInMilliseconds(900000);
