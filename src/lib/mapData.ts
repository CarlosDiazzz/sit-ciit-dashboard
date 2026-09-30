export type MapCoordinate = [latitude: number, longitude: number];

export interface RailConnection {
  name: 'Línea G' | 'Línea K';
  segments: MapCoordinate[][];
}

// Empalme real de las líneas Z y G en los nodos del archivo Overpass.
export const MEDIAS_AGUAS_JUNCTION: MapCoordinate = [17.6798489, -95.0265953];

interface OverpassNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
}

interface OverpassWay {
  type: 'way';
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

interface OverpassRelation {
  type: 'relation';
  tags?: Record<string, string>;
  members?: Array<{ type: string; ref: number; role?: string }>;
}

interface OverpassResponse {
  elements?: Array<OverpassNode | OverpassWay | OverpassRelation | { type: string; id?: number }>;
}

const ORIGEN_CORREDOR: MapCoordinate = [18.14905, -94.4447];
const DESTINO_CORREDOR: MapCoordinate = [16.175, -95.194];

function distanceMeters(a: MapCoordinate, b: MapCoordinate): number {
  const latitudeMeters = (a[0] - b[0]) * 111_320;
  const longitudeMeters = (a[1] - b[1]) * 111_320 * Math.cos(((a[0] + b[0]) / 2 * Math.PI) / 180);
  return Math.hypot(latitudeMeters, longitudeMeters);
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

/** Reconstruye únicamente la Línea Z como una ruta conectada Coatzacoalcos–Salina Cruz. */
export function parseMainRailRoute(input: unknown): MapCoordinate[] {
  if (typeof input !== 'object' || input === null || !('elements' in input) || !Array.isArray(input.elements)) {
    throw new Error('El archivo mapData.txt no tiene elementos geográficos válidos.');
  }
  const elements = input.elements as NonNullable<OverpassResponse['elements']>;
  const normalizedName = (name?: string) => name?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const lineRelation = elements.find((element): element is OverpassRelation =>
    element.type === 'relation' &&
    'tags' in element &&
    element.tags?.type === 'route' &&
    element.tags.route === 'railway' &&
    element.tags.ref === 'Z' &&
    normalizedName(element.tags.name) === 'linea z',
  );

  if (!lineRelation?.members) throw new Error('No se encontró la relación ferroviaria principal Línea Z.');

  const wayIds = new Set(
    lineRelation.members.filter((member) => member.type === 'way').map((member) => member.ref),
  );
  const waysById = new Map<number, OverpassWay>();
  for (const element of elements) {
    if (element.type !== 'way' || !('nodes' in element) || !wayIds.has(element.id)) continue;
    const previous = waysById.get(element.id);
    const score = (way: OverpassWay) =>
      (way.tags?.railway === 'rail' ? 100 : 0) +
      (way.tags?.usage === 'main' ? 20 : 0) +
      (way.tags?.service ? 0 : 10) +
      Object.keys(way.tags ?? {}).length / 1000;
    if (!previous || score(element) > score(previous)) waysById.set(element.id, element);
  }

  const nodesById = new Map<number, MapCoordinate>();
  for (const element of elements) {
    if (element.type === 'node' && 'lat' in element && 'lon' in element) {
      nodesById.set(element.id, [element.lat, element.lon]);
    }
  }

  // Railway service/siding/yard/spur ways and unnamed neighboring railway
  // relations are intentionally excluded; only the tagged Línea Z is eligible.
  const candidates = lineRelation.members.flatMap((member) => {
    if (member.type !== 'way') return [];
    const way = waysById.get(member.ref);
    if (
      !way ||
      way.tags?.railway !== 'rail' ||
      way.tags.service ||
      (way.tags.usage !== undefined && way.tags.usage !== 'main')
    ) return [];

    const coordinates = way.nodes.map((id) => nodesById.get(id));
    if (coordinates.some((coordinate) => coordinate === undefined)) return [];
    return [{ way, coordinates: coordinates as MapCoordinate[] }];
  });

  if (candidates.length === 0) throw new Error('La relación Línea Z no contiene vías principales con coordenadas.');

  // Form connected components by shared OSM endpoint IDs, then retain the
  // component whose two ends best match the Coatzacoalcos and Salina Cruz ports.
  const edgesAtNode = new Map<number, number[]>();
  candidates.forEach(({ way }, edgeIndex) => {
    const endpoints = [way.nodes[0], way.nodes.at(-1)!];
    for (const nodeId of new Set(endpoints)) {
      const edges = edgesAtNode.get(nodeId) ?? [];
      edges.push(edgeIndex);
      edgesAtNode.set(nodeId, edges);
    }
  });

  const components: number[][] = [];
  const visitedEdges = new Set<number>();
  for (let edgeIndex = 0; edgeIndex < candidates.length; edgeIndex += 1) {
    if (visitedEdges.has(edgeIndex)) continue;
    const component: number[] = [];
    const pending = [edgeIndex];
    visitedEdges.add(edgeIndex);
    while (pending.length > 0) {
      const current = pending.pop()!;
      component.push(current);
      const way = candidates[current].way;
      for (const nodeId of [way.nodes[0], way.nodes.at(-1)!]) {
        for (const neighbor of edgesAtNode.get(nodeId) ?? []) {
          if (!visitedEdges.has(neighbor)) {
            visitedEdges.add(neighbor);
            pending.push(neighbor);
          }
        }
      }
    }
    components.push(component);
  }

  const endpointPairs = components.flatMap((component) => {
    const endpointNodes = [...new Set(component.flatMap((index) => {
      const way = candidates[index].way;
      return [way.nodes[0], way.nodes.at(-1)!];
    }))].filter((nodeId) => (edgesAtNode.get(nodeId)?.filter((index) => component.includes(index)).length ?? 0) === 1);
    if (endpointNodes.length !== 2) return [];
    const first = nodesById.get(endpointNodes[0]);
    const second = nodesById.get(endpointNodes[1]);
    if (!first || !second) return [];
    const forwardScore = distanceMeters(first, ORIGEN_CORREDOR) + distanceMeters(second, DESTINO_CORREDOR);
    const reverseScore = distanceMeters(second, ORIGEN_CORREDOR) + distanceMeters(first, DESTINO_CORREDOR);
    return [{ component, start: forwardScore <= reverseScore ? endpointNodes[0] : endpointNodes[1], end: forwardScore <= reverseScore ? endpointNodes[1] : endpointNodes[0], score: Math.min(forwardScore, reverseScore) }];
  });
  const selected = endpointPairs.sort((a, b) => a.score - b.score)[0];
  if (!selected) throw new Error('No se pudo ordenar la vía troncal de la Línea Z.');

  const selectedEdges = new Set(selected.component);
  const usedEdges = new Set<number>();
  const route: MapCoordinate[] = [];
  let currentNode = selected.start;

  while (currentNode !== selected.end) {
    const nextEdge = (edgesAtNode.get(currentNode) ?? []).find(
      (edgeIndex) => selectedEdges.has(edgeIndex) && !usedEdges.has(edgeIndex),
    );
    if (nextEdge === undefined) throw new Error('La relación Línea Z tiene una ruptura en la vía troncal.');

    const { way, coordinates } = candidates[nextEdge];
    const reversed = way.nodes.at(-1) === currentNode;
    const orderedCoordinates = reversed ? [...coordinates].reverse() : coordinates;
    const nextNode = reversed ? way.nodes[0] : way.nodes.at(-1)!;
    if (route.length > 0 && distanceMeters(route.at(-1)!, orderedCoordinates[0]) > 500) {
      throw new Error('La vía troncal de Línea Z tiene un salto mayor de 500 m.');
    }
    route.push(...(route.length > 0 ? orderedCoordinates.slice(1) : orderedCoordinates));
    usedEdges.add(nextEdge);
    currentNode = nextNode;
  }

  if (usedEdges.size !== selected.component.length || route.length < 2) {
    throw new Error('No se pudo construir una ruta continua entre Coatzacoalcos y Salina Cruz.');
  }
  return route;
}

/** Conexiones solicitadas: G hacia el centro del país y K por Juchitán. */
export function parseRailConnections(input: unknown): RailConnection[] {
  if (typeof input !== 'object' || input === null || !('elements' in input) || !Array.isArray(input.elements)) {
    throw new Error('El archivo mapData.txt no tiene elementos geográficos válidos.');
  }
  const elements = input.elements as NonNullable<OverpassResponse['elements']>;
  const nodes = new Map<number, MapCoordinate>();
  for (const element of elements) {
    if (element.type === 'node' && 'lat' in element && 'lon' in element) {
      nodes.set(element.id, [element.lat, element.lon]);
    }
  }

  return (['Línea G', 'Línea K'] as const).map((name) => {
    const seen = new Set<number>();
    const segments = elements.flatMap((element) => {
      if (
        element.type !== 'way' || !('nodes' in element) ||
        element.tags?.railway !== 'rail' || element.tags.name !== name ||
        element.tags.service || element.tags.usage !== 'main' || seen.has(element.id)
      ) return [];
      seen.add(element.id);
      const coordinates = element.nodes.map((id) => nodes.get(id));
      if (coordinates.length < 2 || coordinates.some((point) => point === undefined)) return [];
      return [coordinates as MapCoordinate[]];
    });
    return { name, segments };
  }).filter((connection) => connection.segments.length > 0);
}
