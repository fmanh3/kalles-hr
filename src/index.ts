import { PubSubClient } from '../../kalles-traffic/src/infrastructure/messaging/pubsub-client';
import express from 'express';
import Knex from 'knex';
import config from '../knexfile';
import { ShiftAssignmentRequestedSchema, type ShiftAssignmentRequested } from './domain/events/shift-events';
import { DailyRestPolicy } from './domain/policies/daily-rest-policy';
import { RosteringAgent } from './domain/planning/rostering-agent';

async function start() {
  const db = Knex(config.development!);
  const pubsub = new PubSubClient();
  const rosteringAgent = new RosteringAgent(db);

  // Auto-seed DRIVER-007 for stable testing
  try {
    await db('drivers').insert({ id: 'DRIVER-007', name: 'Kalle Karlsson', hourly_rate: 185.00 }).onConflict('id').ignore();
    const today = new Date(); today.setHours(8, 0, 0, 0);
    const endToday = new Date(today); endToday.setHours(16, 0, 0, 0);
    const exists = await db('shifts').where({ driver_id: 'DRIVER-007', planned_start_time: today.toISOString() }).first();
    if (!exists) {
      await db('shifts').insert({
        driver_id: 'DRIVER-007',
        planned_start_time: today.toISOString(),
        planned_end_time: endToday.toISOString(),
        pickup_location: 'Norrtälje RC',
        line_id: '676',
        status: 'SCHEDULED'
      });
    }
    console.log('[HR] Test driver DRIVER-007 seeded.');
  } catch (e) {
    console.warn('[HR] Auto-seed failed:', e);
  }

  const app = express();
  app.use(express.json());
  const port = process.env.PORT || 8080;

  app.get('/', (req, res) => res.send('Kalles HR Domain is live! 👥'));

  // Autonom förartilldelning (Milstolpe 7)
  app.post('/planning/assign-driver', async (req, res) => {
    try {
      const { shiftId, vehicleType, startTime } = req.body;
      const driverId = await rosteringAgent.assignDriverToShift({
        shiftId,
        vehicleType,
        startTime: new Date(startTime)
      });
      res.json({ message: 'Driver assigned successfully', driverId });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/drivers/:id/schedule', async (req, res) => {
    try {
      const shifts = await db('shifts').where({ driver_id: req.params.id }).orderBy('planned_start_time', 'asc');
      res.json({ driverId: req.params.id, shifts });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/drivers/:id/profile', async (req, res) => {
    try {
      const driver = await db('drivers').where({ id: req.params.id }).first();
      const certs = await db('certifications').where({ driver_id: req.params.id });
      if (!driver) return res.status(404).json({ error: 'Driver not found' });
      res.json({ ...driver, certifications: certs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/simulate/sick-leave', async (req, res) => {
    try {
      const { driverId } = req.body;
      await db('shifts').where({ driver_id: driverId, status: 'SCHEDULED' }).update({ status: 'SICK', updated_at: new Date() });
      res.json({ message: `Sjukanmälan registrerad för ${driverId}.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(port, () => console.log(`[HR] API listening on port ${port}`));

  const HR_TOPIC = 'hr-events';
  const SUB_NAME = 'hr-guardrails-sub';

  await pubsub.subscribe(HR_TOPIC, SUB_NAME, async (event: any) => {
    try {
      // Integration logic...
    } catch (err) {
      console.error('[HR] Event Error:', err);
    }
  });
}

start().catch(console.error);
