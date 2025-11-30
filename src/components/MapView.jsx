import unsafeIconSVG from "../assets/icons/unsafe.svg";
import dimIconSVG from "../assets/icons/dim.svg";
import safeIconSVG from "../assets/icons/safe.svg";
import roadClosedIconSVG from "../assets/icons/road_closed.svg";
import crowdIconSVG from "../assets/icons/crowd.svg";
import cctvIconSVG from "../assets/icons/cctv.svg";

import L from "leaflet";

export const icons = {
  unsafe: L.icon({
    iconUrl: unsafeIconSVG,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -35],
  }),
  dim: L.icon({
    iconUrl: dimIconSVG,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -35],
  }),
  safe: L.icon({
    iconUrl: safeIconSVG,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -35],
  }),
  road_closed: L.icon({
    iconUrl: roadClosedIconSVG,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -35],
  }),
  crowd: L.icon({
    iconUrl: crowdIconSVG,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -35],
  }),
  cctv: L.icon({
    iconUrl: cctvIconSVG,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -35],
  }),
};


import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from "react-leaflet";
import L from "leaflet";
import axios from "axios";
import MarkerClusterGroup from "react-leaflet-cluster";
import { aggregateRouteRisk, riskBand } from "../logic/scoring";
import { haversine } from "../logic/geoutils";


const defaultIcon = new L.Icon.Default();

function ClickHandler({ onMapClick, markerMode }) {
  useMapEvents({
    click(e) {
      if (!markerMode) return;
      const { lat, lng } = e.latlng;
      onMapClick(lat, lng);
    }
  });
  return null;
}

export default function MapView({ userLocation, markers = [], onAddMarker, selectedMarkerType, setSelectedMarkerType }) {
  const mapRef = useRef(null);
  const [dest, setDest] = useState("");
  const [routes, setRoutes] = useState([]); // {path: [[lat,lng]], distance, duration, totalRisk, color}
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);

  
  useEffect(() => {
    if (!userLocation || !mapRef.current) return;
    const map = mapRef.current;
    try {
      map.setView([userLocation.lat, userLocation.lng], 15);
    } catch (e) {}
  }, [userLocation]);

  
  function handleMapClick(lat, lng) {
    
    if (userLocation) {
      const d = haversine(userLocation.lat, userLocation.lng, lat, lng);
      if (d > 100) {
        alert("Move closer to drop this marker (demo relaxed to 100m).");
        return;
      }
    }
    if (!selectedMarkerType) {
      alert("Choose a marker type first (use the floating menu).");
      return;
    }
    onAddMarker(lat, lng);
    setSelectedMarkerType(null);
  }

  
  async function fetchRoutesTo(destinationLatLng) {
    if (!userLocation) return;
    const start = `${userLocation.lng},${userLocation.lat}`;
    const end = `${destinationLatLng.lng},${destinationLatLng.lat}`;
    const url = `https://router.project-osrm.org/route/v1/foot/${start};${end}?overview=full&geometries=geojson&alternatives=true&steps=false`;
    try {
      const res = await axios.get(url);
      const osRoutes = res.data.routes || [];
      const mapped = osRoutes.slice(0, 3).map((r) => {
        // convert [lng,lat] -> [lat,lng]
        const path = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        const totalRisk = aggregateRouteRisk(path, markers);
        const color = riskBand(totalRisk);
        return {
          path,
          distance: r.distance,
          duration: r.duration,
          totalRisk,
          color
        };
      });
      setRoutes(mapped);
      setSelectedRouteIndex(0);
    } catch (err) {
      console.error("OSRM error", err);
      alert("Failed to fetch routes. Try again.");
    }
  }

  // geocode simple: using Nominatim open API for demo (rate limited)
  async function geocodeAndRoute(query) {
    if (!query) return;
    const q = encodeURIComponent(query);
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
    try {
      const r = await axios.get(url, { headers: { "User-Agent": "SafeRoute-Demo" }});
      if (!r.data || r.data.length === 0) {
        alert("Destination not found");
        return;
      }
      const place = r.data[0];
      const destLat = parseFloat(place.lat);
      const destLng = parseFloat(place.lon);
      await fetchRoutesTo({ lat: destLat, lng: destLng });
      // center map on destination
      if (mapRef.current) mapRef.current.setView([destLat, destLng], 14);
    } catch (e) {
      console.error(e);
      alert("Geocoding failed");
    }
  }

  // small UI for selecting marker type
  const markerMenu = (
    <div className="marker-modal">
      <button onClick={() => setSelectedMarkerType("unsafe")} className={selectedMarkerType === "unsafe" ? "active" : ""}>🔴 Unsafe</button>
      <button onClick={() => setSelectedMarkerType("dim")} className={selectedMarkerType === "dim" ? "active" : ""}>🟡 Dim Light</button>
      <button onClick={() => setSelectedMarkerType("safe")} className={selectedMarkerType === "safe" ? "active" : ""}>🟢 Safe</button>
      <button onClick={() => setSelectedMarkerType("road_closed")} className={selectedMarkerType === "road_closed" ? "active" : ""}>⚠️ Road Closed</button>
      <button onClick={() => setSelectedMarkerType("crowd")} className={selectedMarkerType === "crowd" ? "active" : ""}>👥 Crowd</button>
      <button onClick={() => setSelectedMarkerType("cctv")} className={selectedMarkerType === "cctv" ? "active" : ""}>📷 CCTV</button>
    </div>
  );

  return (
    <div className="map-wrapper">
      <div className="map-search">
        <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="Enter destination (city, address)"/>
        <button onClick={() => geocodeAndRoute(dest)}>Go</button>
      </div>

      <MapContainer
        center={userLocation ? [userLocation.lat, userLocation.lng] : [20.5937,78.9629]}
        zoom={13}
        style={{ height: "calc(100vh - 130px)", width: "100%" }}
        whenCreated={(map) => { mapRef.current = map; }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        
          <MarkerClusterGroup>
  {markers.map((m) => (
    <Marker
      key={m.id}
      position={[m.lat, m.lng]}
      icon={icons[m.type]}   
    >
      <Popup>
        <b>{m.type.toUpperCase()}</b><br/>
        {new Date(m.timestamp).toLocaleString()}
      </Popup>
    </Marker>
  ))}
</MarkerClusterGroup>

      

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={defaultIcon}>
            <Popup>You are here</Popup>
          </Marker>
        )}

        {/* draw the routes */}
        {routes.map((r, i) => (
          <Polyline
            key={i}
            positions={r.path}
            color={i === selectedRouteIndex ? r.color : "#888"}
            weight={i === selectedRouteIndex ? 6 : 3}
            opacity={0.8}
            eventHandlers={{
              click: () => setSelectedRouteIndex(i)
            }}
          />
        ))}

        <ClickHandler onMapClick={handleMapClick} markerMode={!!selectedMarkerType} />
      </MapContainer>

      {/* floating UI */}
      <div className="floating-controls">
        <div style={{ display: "flex", gap: 8 }}>
          <button className="floating-btn" onClick={() => { setSelectedMarkerType("unsafe"); alert("Tap map to place marker"); }}>🔴</button>
          <button className="floating-btn" onClick={() => { setSelectedMarkerType("dim"); alert("Tap map to place marker"); }}>🟡</button>
          <button className="floating-btn" onClick={() => { setSelectedMarkerType("safe"); alert("Tap map to place marker"); }}>🟢</button>
        </div>
        {markerMenu}
      </div>

      {/* route panel */}
      <div className="route-panel">
        {routes.length === 0 && <div className="skeleton">No routes yet — search a destination</div>}
        {routes.map((r, i) => (
          <div key={i} className="route-box" onClick={() => setSelectedRouteIndex(i)}>
            <h3 style={{ color: r.color }}>
              {r.color === "green" ? "Safe Route" : r.color === "yellow" ? "Balanced" : "Risky"}
            </h3>
            <p>{(r.distance/1000).toFixed(2)} km • {(r.duration/60).toFixed(0)} min</p>
            <p>Risk Score: {r.totalRisk.toFixed(1)}</p>
            <button onClick={() => setSelectedRouteIndex(i)}>Choose</button>
          </div>
        ))}
      </div>
    </div>
  );
}
