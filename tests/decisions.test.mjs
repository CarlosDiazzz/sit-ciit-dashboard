import assert from 'node:assert/strict';
import test from 'node:test';
import { prioritizeEvents, eventGuidance } from '../src/lib/decisions.ts';

// Fixtures exclusivamente de prueba; nunca se muestran en el dashboard.
const event = (id, severity, acknowledgedAt = null, ts = '2026-09-29T12:00:00Z') => ({
  id, severity, acknowledgedAt, ts, unitId: 'test-unit', nodeId: 'test-node',
  kind: 'impact', value: 2, threshold: 1, gpsLat: null, gpsLon: null,
  receivedAt: ts, acknowledgedBy: null,
});

test('prioriza pendientes por encima de confirmados, y críticos antes de advertencias', () => {
  const input = [event('confirmed', 'critical', '2026-09-29T12:01:00Z'), event('info', 'info'), event('warning', 'warning'), event('critical', 'critical')];
  const before = [...input];
  assert.deepEqual(prioritizeEvents(input).map(e => e.id), ['critical', 'warning', 'info', 'confirmed']);
  assert.deepEqual(input, before, 'no modifica el resultado de la API');
});

test('entre eventos de igual prioridad presenta primero el más reciente', () => {
  assert.deepEqual(prioritizeEvents([event('old', 'warning'), event('new', 'warning', null, '2026-09-29T13:00:00Z')]).map(e => e.id), ['new', 'old']);
  assert.deepEqual(prioritizeEvents([]), []);
});

test('todos los tipos de evento tienen orientación para revisión humana', () => {
  for (const kind of ['impact', 'door_open', 'door_closed', 'rollover', 'threshold_exceeded', 'source_failover', 'sensor_disagreement']) {
    assert.ok(eventGuidance[kind]?.length > 20, kind);
  }
});
