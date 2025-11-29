import React, { useEffect, useState } from "react";
import MapView from "./components/MapView";
import { db } from "./firebase/config";
import { ref, push, onValue, remove } from "firebase/database";
import { haversine } from "./logic/geoutils";

export default function App() {
  const [userLocation, setUserLocation] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [selectedMarkerType, setSelectedMarkerType] = useState(null);
  const [lastMarkerTime, setLastMarkerTime] = useState(0);

  
  useEffect(() => {
    if (!navigator.geolocation) {
      alert("Location not supported.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => alert("Failed to get location"),
      { enableHighAccuracy: true }
    );
  }, []);

  
  useEffect(() => {
    const markersRef = ref(db, "markers");
    onValue(markersRef, (snapshot) => {
      const data = snapshot.val() || {};

      const arr = Object.keys(data).map((id) => ({
        id,
        ...data[id],
      }));

      
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;

      arr.forEach((m) => {
        if (m.timestamp < cutoff) {
          remove(ref(db, `markers/${m.id}`));
        }
      });

      setMarkers(arr);
    });
  }, []);

  
  function addMarker(lat, lng) {
    if (!userLocation) {
      alert("Enable location first.");
      return;
    }

    if (!selectedMarkerType) {
      alert("Select a marker type.");
      return;
    }

    
    const d = haversine(
      userLocation.lat,
      userLocation.lng,
      lat,
      lng
    );

    if (d > 100) {
      alert("Move closer to place the marker. (demo: 100m)");
      return;
    }

    
    if (Date.now() - lastMarkerTime < 2 * 60 * 1000) {
      alert("Wait 2 minutes before adding another marker.");
      return;
    }

    
    for (let m of markers) {
      if (m.type === selectedMarkerType) {
        const dist = haversine(m.lat, m.lng, lat, lng);
        if (dist < 20) {
          alert("A similar marker exists nearby.");
          return;
        }
      }
    }

    const newMarker = {
      lat,
      lng,
      type: selectedMarkerType,
      timestamp: Date.now(),
    };

    push(ref(db, "markers"), newMarker);
    setLastMarkerTime(Date.now());
  }

  return (
    <div>
      <h1 className="app-title">SafeRoute Navigation</h1>

      <MapView
        userLocation={userLocation}
        markers={markers}
        onAddMarker={addMarker}
        selectedMarkerType={selectedMarkerType}
        setSelectedMarkerType={setSelectedMarkerType}
      />
    </div>
  );
}
