export const getCurrentPosition = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
    } else {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      });
    }
  });
};

export const reverseGeocode = async (lat, lon) => {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
    if (!response.ok) {
      throw new Error('Failed to fetch address');
    }
    const data = await response.json();
    
    // Extract user-friendly address string: [Road/Suburb, Area Name, City, State]
    const address = data.address;
    const road = address.road || address.suburb || '';
    const area = address.neighbourhood || address.residential || address.city_district || '';
    const city = address.city || address.town || address.village || address.county || '';
    const state = address.state || '';
    
    const formattedAddressParts = [road, area, city, state].filter(part => part.length > 0);
    const formattedAddress = formattedAddressParts.join(', ');
    
    return {
      formattedAddress: formattedAddress || 'Unknown Location',
      raw: data
    };
  } catch (error) {
    console.error('Reverse Geocoding Error:', error);
    throw error;
  }
};
