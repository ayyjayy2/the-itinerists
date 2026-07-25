/** WMO weather code (Open-Meteo `weather_code`) → human condition + emoji. */
export interface WeatherCondition {
  emoji: string;
  label: string;
}

export function weatherLabel(code: number): WeatherCondition {
  if (code === 0)                  return { emoji: '☀️', label: 'Sunny' };
  if (code === 1 || code === 2)    return { emoji: '🌤️', label: 'Partly cloudy' };
  if (code === 3)                  return { emoji: '☁️', label: 'Cloudy' };
  if (code === 45 || code === 48)  return { emoji: '🌫️', label: 'Foggy' };
  if (code >= 51 && code <= 57)    return { emoji: '🌦️', label: 'Drizzly' };
  if ((code >= 61 && code <= 67) ||
      (code >= 80 && code <= 82))  return { emoji: '🌧️', label: 'Rainy' };
  if ((code >= 71 && code <= 77) ||
      code === 85 || code === 86)  return { emoji: '❄️', label: 'Snowy' };
  if (code >= 95 && code <= 99)    return { emoji: '⛈️', label: 'Stormy' };
  return { emoji: '🌡️', label: 'Mixed' };
}
