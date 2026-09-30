export type MapCoordinate = [latitude: number, longitude: number];

interface OverpassNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
}

interface OverpassWay {
  type: 'way';
  nodes: number[];
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: Array<OverpassNode | OverpassWay | { type: string }>;
}

/** Convierte la respuesta JSON de Overpass en segmentos con coordenadas Leaflet. */
export function parseRailSegments(input: unknown): MapCoordinate[][] {
  if (typeof input !== 'object' || input === null || !('elements' in input) || !Array.isArray(input.elements)) {
    throw new Error('El archivo mapData.txt no tiene elementos geográficos válidos.');
  }
  const data = input as OverpassResponse & { elements: NonNullable<OverpassResponse['elements']> };

  const nodes = new Map<number, MapCoordinate>();
  for (const element of data.elements) {
    if (element.type === 'node' && 'lat' in element && 'lon' in element) {
      nodes.set(element.id, [element.lat, element.lon]);
    }
  }

  return data.elements.flatMap((element) => {
    if (element.type !== 'way' || !('nodes' in element) || element.tags?.railway !== 'rail') return [];
    const segment = element.nodes
      .map((id) => nodes.get(id))
      .filter((coordinate): coordinate is MapCoordinate => coordinate !== undefined);
    return segment.length > 1 ? [segment] : [];
  });
}
