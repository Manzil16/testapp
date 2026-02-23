import { View, StyleSheet, Text } from "react-native";
import MapView, { Polyline } from "react-native-maps";
import { useTripStore } from "../src/store/useTripStore";
import polyline from "@mapbox/polyline";

export default function TripPlan() {
  const {
    polyline: encodedPolyline,
    origin,
    destination,
    distanceKm,
    durationMinutes,
    predictedArrivalPercent,
  } = useTripStore();

  const coordinates =
    encodedPolyline
      ? polyline.decode(encodedPolyline).map(
  ([lat, lng]: [number, number]) => ({
          latitude: lat,
          longitude: lng,
        }))
      : [];

  if (!origin || !destination) {
    return null;
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: origin.latitude,
          longitude: origin.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {coordinates.length > 0 && (
          <Polyline
            coordinates={coordinates}
            strokeWidth={4}
            strokeColor="blue"
          />
        )}
      </MapView>

      <View style={styles.infoBox}>
        <Text>Distance: {distanceKm.toFixed(1)} km</Text>
        <Text>ETA: {durationMinutes.toFixed(0)} min</Text>
        <Text>
          Arrival Battery: {predictedArrivalPercent.toFixed(1)}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  infoBox: {
    position: "absolute",
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: "white",
    padding: 15,
    borderRadius: 10,
  },
});