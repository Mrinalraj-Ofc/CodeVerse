// src/components/RoutePanel.jsx
import React from "react";

export default function RoutePanel({ routes = [], selectedIndex, onSelect }) {
  return (
    <div className="route-panel">
      {routes.length === 0 && <div className="skeleton">Search a destination to show routes</div>}
      {routes.map((r, i) => (
        <div key={i} className="route-box" onClick={() => onSelect(i)} style={{ border: selectedIndex===i ? "2px solid #4e79ff": "1px solid #eee" }}>
          <h4 style={{ color: r.color }}>{ r.color === "green" ? "Safe" : r.color === "yellow" ? "Balanced" : "Risky" } Route</h4>
          <p>{(r.distance/1000).toFixed(2)} km • {(r.duration/60).toFixed(0)} min</p>
          <p>Risk: {r.totalRisk.toFixed(1)}</p>
        </div>
      ))}
    </div>
  );
}
