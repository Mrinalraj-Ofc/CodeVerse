import { haversine } from "./geoutils";
export function computeSegmentRisk(segA, segB, markers = [], currentTime = new Date()) {
  let risk = 0;
 
  const len = haversine(segA[0], segA[1], segB[0], segB[1]);
  if (len > 500) risk += 1;

  
  const midLat = (segA[0] + segB[0]) / 2;
  const midLng = (segA[1] + segB[1]) / 2;

 
  for (const m of markers) {
    const d = haversine(midLat, midLng, m.lat, m.lng);
    if (d <= 50) {
      if (m.type === "unsafe") risk += 5;
      else if (m.type === "dim") risk += 3;
      else if (m.type === "safe") risk -= 3;
      else if (m.type === "road_closed") risk += 2;
      else if (m.type === "crowd") risk -= 1;
      
    }
  }

  
  const hr = currentTime.getHours();
  let mult = 1;
  if (hr >= 23 || hr < 3) mult = 2;
  else if (hr >= 19 || hr < 5) mult = 1.5;

  
  const finalRisk = risk * mult;
  return Math.max(0, finalRisk); // never negative
}

export function aggregateRouteRisk(path, markers) {
  
  const segmentRisks = [];
  for (let i = 0; i < path.length - 1; i++) {
    const r = computeSegmentRisk(path[i], path[i + 1], markers);
    segmentRisks.push(r);
  }
  const total = segmentRisks.reduce((a, b) => a + b, 0);
  return total;
}

export function riskBand(totalRisk) {
  if (totalRisk <= 5) return "green";
  if (totalRisk <= 12) return "yellow";
  return "red";
}