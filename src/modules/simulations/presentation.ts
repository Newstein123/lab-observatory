import { formatAngleArcsec, formatNumber } from "@/lib/format";
import type { CameraMetrics, EyepieceMetrics, Metric } from "./engine";

/** Display labels and formatting for engine metrics. UI-only; no science here. */

type MetricKey = keyof EyepieceMetrics | keyof CameraMetrics;

interface MetricPresentation {
  label: string;
  format: (m: Metric) => string;
}

const withUnit = (digits: number) => (m: Metric) => `${formatNumber(m.value, digits)}${m.unit ? ` ${m.unit}` : ""}`;

export const METRIC_PRESENTATION: Record<MetricKey, MetricPresentation> = {
  magnification: { label: "Magnification", format: (m) => `${formatNumber(m.value, m.value < 10 ? 1 : 0)}×` },
  exitPupil: { label: "Exit pupil", format: withUnit(2) },
  trueFov: { label: "True field of view", format: (m) => formatAngleArcsec(m.value * 3600) },
  maxUsefulMagnification: { label: "Max useful magnification", format: (m) => `~${formatNumber(m.value, 0)}×` },
  surfaceBrightnessVsEye: {
    label: "Extended-object brightness vs. eye",
    format: (m) => `${formatNumber(m.value * 100, 0)}%`,
  },
  effectiveFocalLength: { label: "Effective focal length", format: withUnit(0) },
  focalRatio: { label: "Focal ratio", format: (m) => `f/${formatNumber(m.value, 1)}` },
  dawesLimit: { label: "Dawes limit", format: (m) => `${formatNumber(m.value, 2)}″` },
  rayleighLimit: { label: "Rayleigh limit", format: (m) => `${formatNumber(m.value, 2)}″` },
  effectiveResolution: { label: "Effective resolution (with seeing)", format: (m) => `${formatNumber(m.value, 2)}″` },
  lightGatheringVsEye: { label: "Light gathering vs. eye", format: (m) => `${formatNumber(m.value, 0)}×` },
  limitingMagnitude: { label: "Limiting stellar magnitude", format: (m) => formatNumber(m.value, 1) },
  imageScale: { label: "Image scale", format: (m) => `${formatNumber(m.value, 2)}″/px` },
  sensorFovWidth: { label: "Sensor field (width)", format: (m) => formatAngleArcsec(m.value * 60) },
  sensorFovHeight: { label: "Sensor field (height)", format: (m) => formatAngleArcsec(m.value * 60) },
  samplingRatio: { label: "Pixels across seeing disc", format: (m) => formatNumber(m.value, 2) },
  relativeExposureIndex: { label: "Relative brightness", format: (m) => `${formatNumber(m.value, 2)}× ref` },
  relativeNoise: { label: "Relative noise", format: (m) => `${formatNumber(m.value, 2)}× ref` },
  filterTransmission: { label: "Filter transmission", format: (m) => `${formatNumber(m.value * 100, 0)}%` },
  trailLength: { label: "Sky drift (untracked)", format: (m) => formatAngleArcsec(m.value) },
  trailPixels: { label: "Drift on sensor", format: (m) => `${formatNumber(m.value, m.value < 10 ? 1 : 0)} px` },
  skyBrightness: { label: "Sky brightness", format: (m) => `${formatNumber(m.value, 1)} mag/″²` },
  skyBackgroundAtEye: { label: "Sky background at the eyepiece", format: (m) => `${formatNumber(m.value, 1)} mag/″²` },
  extinction: { label: "Atmospheric dimming", format: (m) => `${formatNumber(m.value, 2)} mag` },
  airmass: { label: "Air mass", format: (m) => formatNumber(m.value, 2) },
  effectiveSeeing: { label: "Seeing at this altitude", format: (m) => `${formatNumber(m.value, 1)}″` },
  cloudTransmission: { label: "Light through cloud", format: (m) => `${formatNumber(m.value * 100, 0)}%` },
};

export const EYEPIECE_METRIC_ORDER: (keyof EyepieceMetrics)[] = [
  "magnification",
  "exitPupil",
  "trueFov",
  "dawesLimit",
  "effectiveResolution",
  "maxUsefulMagnification",
  "surfaceBrightnessVsEye",
  "filterTransmission",
  "effectiveFocalLength",
  "focalRatio",
  "rayleighLimit",
  "lightGatheringVsEye",
  "limitingMagnitude",
  "skyBrightness",
  "skyBackgroundAtEye",
  "extinction",
  "airmass",
  "effectiveSeeing",
  "cloudTransmission",
];

export const CAMERA_METRIC_ORDER: (keyof CameraMetrics)[] = [
  "imageScale",
  "sensorFovWidth",
  "sensorFovHeight",
  "samplingRatio",
  "dawesLimit",
  "effectiveResolution",
  "relativeExposureIndex",
  "relativeNoise",
  "trailLength",
  "trailPixels",
  "filterTransmission",
  "effectiveFocalLength",
  "focalRatio",
  "rayleighLimit",
  "lightGatheringVsEye",
  "limitingMagnitude",
  "skyBrightness",
  "extinction",
  "airmass",
  "effectiveSeeing",
  "cloudTransmission",
];
