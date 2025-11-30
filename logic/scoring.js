// scoring.js
import { haversine } from "./geoutils";

// Risk scoring weights
const RISK_WEIGHTS = {
  unsafe: 5,
  dim: 3,
  road_closed: 2,
  crowd: -1,
  safe: -3,
  cctv: -1,
};

// Compute risk of one segment in the path
export function computeSegmentRisk(segment, markers) {
  const [p1, p2] = segment;

  let risk = 0;

  markers.forEach((m) => {
    const dist1 = haversine(p1[0], p1[1], m.lat, m.lng);
    const dist2 = haversine(p2[0], p2[1], m.lat, m.lng);
    const minDist = Math.min(dist1, dist2);

    if (minDist <= 50 && RISK_WEIGHTS[m.type] !== undefined) {
      risk += RISK_WEIGHTS[m.type];
    }
  });

  return risk;
}

// Total route risk
export function aggregateRouteRisk(path, markers) {
  let total = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const seg = [path[i], path[i + 1]];
    total += computeSegmentRisk(seg, markers);
  }

  return total;
}

// Color of route depending on total risk
export function riskBand(score) {
  if (score <= 5) return "green";
  if (score <= 12) return "yellow";
  return "red";
}
