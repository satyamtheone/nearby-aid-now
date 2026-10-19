// Reverse geocoding utility using OpenStreetMap Nominatim (free, no API key required)
// Falls back to Google Maps Geocoding API if configured

const GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY"; // Optional: replace with your key

interface NominatimResponse {
  display_name?: string;
  address?: {
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
  };
  error?: string;
}

const formatNiceName = (
  address: NominatimResponse["address"]
): string | null => {
  if (!address) return null;

  // Priority: road/area → locality → city → state → country
  const locality =
    address.road ||
    address.neighbourhood ||
    address.suburb ||
    address.city ||
    address.town ||
    address.village ||
    address.municipality;

  if (locality && address.state) {
    return `${locality}, ${address.state}`;
  }

  if (locality && address.country) {
    return `${locality}, ${address.country}`;
  }

  if (address.state && address.country) {
    return `${address.state}, ${address.country}`;
  }

  if (address.country) {
    return address.country;
  }

  return locality || null;
};

export const reverseGeocode = async (
  lat: number,
  lng: number
): Promise<string> => {
  // Try OpenStreetMap Nominatim first (free, no key needed)
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (response.ok) {
      const data: NominatimResponse = await response.json();
      if (data && !data.error) {
        const niceName = formatNiceName(data.address);
        if (niceName) {
          console.log("Geocoding: OSM Nominatim result:", niceName);
          return niceName;
        }
        if (data.display_name) {
          console.log(
            "Geocoding: OSM Nominatim display_name:",
            data.display_name
          );
          return data.display_name;
        }
      }
    }
  } catch (error) {
    console.error("Geocoding: OSM Nominatim error:", error);
  }

  // Fallback to Google Maps Geocoding API if configured
  try {
    if (
      GOOGLE_MAPS_API_KEY &&
      GOOGLE_MAPS_API_KEY !== "YOUR_GOOGLE_MAPS_API_KEY"
    ) {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === "OK" && data.results && data.results.length > 0) {
        const result = data.results[0];

        if (result.formatted_address) {
          return result.formatted_address;
        }

        const components = result.address_components || [];
        const locality = components.find((c: any) =>
          c.types.includes("locality")
        )?.long_name;
        const admin = components.find((c: any) =>
          c.types.includes("administrative_area_level_1")
        )?.long_name;
        const country = components.find((c: any) =>
          c.types.includes("country")
        )?.long_name;

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
    }
  } catch (error) {
    console.error("Geocoding: Google error:", error);
  }

  // Final fallback to coordinates
  console.log("Geocoding: All services failed, using coordinates");
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
};
