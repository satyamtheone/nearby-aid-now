
// Google Maps Geocoding API utility
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    // Get Google Maps API key from environment or you'll need to set it
    const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY'; // You'll need to replace this
    
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') {
      console.warn('Google Maps API key not configured, using coordinate fallback');
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      // Get the most relevant address component
      const result = data.results[0];
      
      // Try to get a nice formatted address
      if (result.formatted_address) {
        return result.formatted_address;
      }
      
      // Fallback to address components
      const components = result.address_components || [];
      const locality = components.find(c => c.types.includes('locality'))?.long_name;
      const admin = components.find(c => c.types.includes('administrative_area_level_1'))?.long_name;
      const country = components.find(c => c.types.includes('country'))?.long_name;
      
      if (locality && admin && country) {
        return `${locality}, ${admin}, ${country}`;
      } else if (locality && country) {
        return `${locality}, ${country}`;
      } else if (admin && country) {
        return `${admin}, ${country}`;
      } else if (country) {
        return country;
      }
    }
    
    // If no results, fallback to coordinates
    console.log('No geocoding results found, using coordinates');
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    
  } catch (error) {
    console.error('Geocoding error:', error);
    // Fallback to coordinates on any error
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};
