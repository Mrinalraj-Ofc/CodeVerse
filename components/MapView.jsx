// src/components/MapView.jsx
import React, { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import L from "leaflet";
import axios from "axios";
import MarkerClusterGroup from "react-leaflet-cluster";

import { db } from "../lib/firebase"; // your existing firebase init
import { ref, push, onValue } from "firebase/database";

import { icons } from "../utils/icons"; // the file above
import { aggregateRouteRisk, riskBand } from "../logic/scoring"; // your scoring utils
import { haversine } from "../logic/geoutils"; // optional distance check

// default leaflet icon (fallback)
const defaultIcon = new L.Icon.Default();

// handle clicks when placing markers
function ClickHandler({ onMapClick, markerMode }) {
  useMapEvents({
    click(e) {
      if (!markerMode) return;
      const { lat, lng } = e.latlng;
      onMapClick(lat, lng);
    },
  });
  return null;
}

export default function MapView({ userLocation }) {
  const mapRef = useRef(null);

  // markers loaded from Firebase
  const [markers, setMarkers] = useState([]);

  // UI state
  const [selectedMarkerType, setSelectedMarkerType] = useState(null);
  const [dest, setDest] = useState("");
  const [routes, setRoutes] = useState([]); // up to 3 routes
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);

  // load markers from Realtime DB at /markers
  useEffect(() => {
    const markersRef = ref(db, "markers");

    const unsubscribe = onValue(markersRef, (snap) => {
      const data = snap.val();
      if (!data) {
        setMarkers([]);
        return;
      }

      const list = Object.keys(data).map((id) => ({
        id,
        ...data[id],
      }));

      setMarkers(list);
    });

    // cleanup subscription when MapView unmounts
    return () => {
      unsubscribe(); // THIS FIXES THE WARNING
    };
  }, []);

  // auto-center map when user location arrives
  useEffect(() => {
    if (!userLocation || !mapRef.current) return;
    try {
      mapRef.current.setView([userLocation.lat, userLocation.lng], 14);
    } catch (e) {
      /* ignore */
    }
  }, [userLocation]);

  // Add marker to firebase
  function handleMapClick(lat, lng) {
    // optional: require user to be near to drop markers (demo)
    if (userLocation) {
      const d = haversine
        ? haversine(userLocation.lat, userLocation.lng, lat, lng)
        : 0;
      if (d > 100) {
        alert("Move closer to drop this marker (demo relaxed to 100m).");
        return;
      }
    }

    if (!selectedMarkerType) {
      alert("Choose a marker type first (use the floating menu).");
      return;
    }

    // push to /markers
    push(ref(db, "markers"), {
      lat,
      lng,
      type: selectedMarkerType,
      timestamp: Date.now(),
      description: "",
    });

    setSelectedMarkerType(null);
  }

  // fetch up to 3 OSRM routes and compute risk/color
  async function fetchRoutesTo(destinationLatLng) {
    if (!destinationLatLng) return;
    const start = userLocation
      ? `${userLocation.lng},${userLocation.lat}`
      : `85.8245,20.2961`; // Bhubaneswar fallback
    const end = `${destinationLatLng.lng},${destinationLatLng.lat}`;

    const url = `https://router.project-osrm.org/route/v1/foot/${start};${end}?overview=full&geometries=geojson&alternatives=true&steps=false`;

    try {
      const res = await axios.get(url);
      const osRoutes = (res.data && res.data.routes) || [];

      const mapped = osRoutes.slice(0, 3).map((r) => {
        const path = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        const totalRisk =
          typeof aggregateRouteRisk === "function"
            ? aggregateRouteRisk(path, markers)
            : 0;
        const color =
          typeof riskBand === "function" ? riskBand(totalRisk) : "#2E8B57";
        return {
          path,
          distance: r.distance,
          duration: r.duration,
          totalRisk,
          color,
        };
      });

      setRoutes(mapped);
      setSelectedRouteIndex(0);
    } catch (err) {
      console.error("OSRM error", err);
      alert("Failed to fetch routes. Try again.");
    }
  }

  // geocode using nominatim and then fetch routes
  async function geocodeAndRoute(query) {
    if (!query) return;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=json&limit=1`;

    try {
      const r = await axios.get(url, {
        headers: { "User-Agent": "SafeRoute-App" },
      });
      if (!r.data || r.data.length === 0) {
        alert("Destination not found");
        return;
      }
      const place = r.data[0];
      const destLat = parseFloat(place.lat);
      const destLng = parseFloat(place.lon);
      await fetchRoutesTo({ lat: destLat, lng: destLng });

      if (mapRef.current) mapRef.current.setView([destLat, destLng], 14);
    } catch (e) {
      console.error("geocode error", e);
      alert("Geocoding failed");
    }
  }

  return (
    <div className="map-wrapper">
      {/* Search */}
      <div style={{ padding: 8, display: "flex", gap: 8 }}>
        <input
          value={dest}
          onChange={(e) => setDest(e.target.value)}
          placeholder="Search destination (e.g. Silicon University)"
          style={{ flex: 1, padding: 6 }}
        />
        <button onClick={() => geocodeAndRoute(dest)}>Go</button>
      </div>

      <MapContainer
        center={
          userLocation
            ? [userLocation.lat, userLocation.lng]
            : [20.2961, 85.8245]
        }
        zoom={13}
        style={{ height: "calc(100vh - 160px)", width: "100%" }}
        whenCreated={(map) => (mapRef.current = map)}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* Markers cluster */}
        <MarkerClusterGroup>
          {markers.map((m) => {
            const icon = icons[m.type] || defaultIcon;
            return (
              <Marker key={m.id} position={[m.lat, m.lng]} icon={icon}>
                <Popup>
                  <b>{m.type?.toUpperCase()}</b>
                  <br />
                  {m.description || ""}
                  <br />
                  {new Date(m.timestamp).toLocaleString()}
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>

        {/* user location */}
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={icons.safe || defaultIcon}
          >
            <Popup>You are here</Popup>
          </Marker>
        )}

        {/* draw routes (up to 3) */}
        {routes.map((r, i) => (
          <Polyline
            key={i}
            positions={r.path}
            color={i === selectedRouteIndex ? r.color : "#888"}
            weight={i === selectedRouteIndex ? 6 : 3}
            opacity={0.9}
            eventHandlers={{
              click: () => setSelectedRouteIndex(i),
            }}
          />
        ))}

        <ClickHandler
          onMapClick={handleMapClick}
          markerMode={!!selectedMarkerType}
        />
      </MapContainer>

      {/* Floating marker buttons */}
      <div
        style={{
          padding: 8,
          display: "flex",
          gap: 8,
          justifyContent: "center",
        }}
      >
        <button
          onClick={() => {
            setSelectedMarkerType("unsafe");
            alert("Tap map to place marker (unsafe).");
          }}
        >
          🔴
        </button>
        <button
          onClick={() => {
            setSelectedMarkerType("dim");
            alert("Tap map to place marker (dim).");
          }}
        >
          🟡
        </button>
        <button
          onClick={() => {
            setSelectedMarkerType("road_closed");
            alert("Tap map to place marker (road closed).");
          }}
        >
          ⚠
        </button>
      </div>

      {/* Route panel */}
      <div style={{ padding: 8 }}>
        {routes.length === 0 ? (
          <div>No routes yet — search a destination</div>
        ) : (
          routes.map((r, i) => (
            <div
              key={i}
              onClick={() => setSelectedRouteIndex(i)}
              style={{
                border:
                  i === selectedRouteIndex
                    ? `2px solid ${r.color}`
                    : "1px solid #ddd",
                padding: 8,
                marginBottom: 6,
                cursor: "pointer",
              }}
            >
              <h4 style={{ color: r.color }}>
                {r.color === "green"
                  ? "Safe"
                  : r.color === "yellow"
                  ? "Balanced"
                  : "Risky"}
              </h4>
              <div>
                {(r.distance / 1000).toFixed(2)} km •{" "}
                {(r.duration / 60).toFixed(0)} min
              </div>
              <div>
                Risk:{" "}
                {r.totalRisk.toFixed ? r.totalRisk.toFixed(1) : r.totalRisk}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
