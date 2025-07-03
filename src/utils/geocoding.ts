
// Simple geocoding utility that formats coordinates nicely
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    // For now, we'll format the coordinates nicely
    // In the future, this could be enhanced with a backend service
    const latFormatted = lat.toFixed(4);
    const lngFormatted = lng.toFixed(4);
    
    // Try to determine rough location based on coordinates
    const locationName = getLocationByCoordinates(lat, lng);
    
    return locationName || `${latFormatted}, ${lngFormatted}`;
  } catch (error) {
    console.log('Geocoding fallback to coordinates');
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

// Basic location detection based on coordinate ranges
const getLocationByCoordinates = (lat: number, lng: number): string | null => {
  // India coordinate ranges
  if (lat >= 6.0 && lat <= 37.0 && lng >= 68.0 && lng <= 97.0) {
    // Major Indian cities
    if (lat >= 28.4 && lat <= 28.7 && lng >= 77.0 && lng <= 77.5) {
      return "Delhi, India";
    }
    if (lat >= 19.0 && lat <= 19.3 && lng >= 72.7 && lng <= 73.0) {
      return "Mumbai, India";
    }
    if (lat >= 12.8 && lat <= 13.1 && lng >= 77.4 && lng <= 77.8) {
      return "Bangalore, India";
    }
    if (lat >= 22.4 && lat <= 22.7 && lng >= 88.2 && lng <= 88.5) {
      return "Kolkata, India";
    }
    if (lat >= 17.3 && lat <= 17.5 && lng >= 78.3 && lng <= 78.6) {
      return "Hyderabad, India";
    }
    if (lat >= 13.0 && lat <= 13.2 && lng >= 80.1 && lng <= 80.4) {
      return "Chennai, India";
    }
    return "India";
  }
  
  return null;
};
