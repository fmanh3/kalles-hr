import { PubSubClient } from '../../kalles-traffic/src/infrastructure/messaging/pubsub-client';
import express from 'express';
import Knex from 'knex';
import config from '../knexfile';
import { ShiftAssignmentRequestedSchema, type ShiftAssignmentRequested } from './domain/events/shift-events';
import { DailyRestPolicy } from './domain/policies/daily-rest-policy';

async function start() {
  const db = Knex(config.development!);
  const pubsub = new PubSubClient();

  // Start a minimal heartbeat server for Cloud Run health checks
  const app = express();
  app.use(express.json());
  const port = process.env.PORT || 8080;

  app.get('/', (req, res) => res.send('Kalles HR Domain is live! 👥'));

  // Simulator: Sjukanmälan (Yttre Ringen)
  app.post('/simulate/sick-leave', async (req, res) => {
    try {
      const { driverId } = req.body;
      console.log(`[HR Simulator] Sjukanmälan mottagen för ${driverId}`);
      
      // Markera aktiva pass som SICK
      await db('shifts')
        .where({ driver_id: driverId, status: 'SCHEDULED' })
        .update({ status: 'SICK', updated_at: new Date() });

      res.json({ message: `Sjukanmälan registrerad för ${driverId}. Pass har avbokats.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(port, () => console.log(`[HR] API & Heartbeat listening on port ${port}`));

  const HR_TOPIC = 'hr-events';
  const SUB_NAME = 'hr-guardrails-sub';

  console.log('--- KALLES HR: GUARDRAILS & POLICIES ---');

  await pubsub.subscribe(HR_TOPIC, SUB_NAME, async (event: ShiftAssignmentRequested) => {
    try {
      // Validera inkommande event
      const parsedEvent = ShiftAssignmentRequestedSchema.parse(event);
      console.log(`\n[HR Guardrail] Tar emot begäran om pass-tilldelning för ${parsedEvent.driverId}...`);

      // Hämta förarens senaste avslutade pass från riktiga databasen
      const lastShift = await db('shifts')
        .where({ driver_id: parsedEvent.driverId, status: 'COMPLETED' })
        .orderBy('planned_end_time', 'desc')
        .first();

      if (!lastShift) {
         console.log(`[HR Guardrail] Ingen historik hittad i databasen för ${parsedEvent.driverId}. Tilldelning godkänd.`);
         return;
      }

      // Kör vår Policy (Guardrail)
      console.log(`[HR Guardrail] Utvärderar DailyRestPolicy (Min 11h vila). Förare slutade senast: ${new Date(lastShift.planned_end_time).toLocaleString()}`);
      
      const lastEndTime = new Date(lastShift.planned_end_time);
      const proposedStartTime = new Date(parsedEvent.proposedStartTime);
      
      try {
          DailyRestPolicy.evaluate(lastEndTime, proposedStartTime);
          console.log(`[HR Guardrail] ✅ Policy uppfylld. Godkänner tilldelning.`);
          
          // Spara det nya passet som SCHEDULED i databasen
          await db('shifts').insert({
            driver_id: parsedEvent.driverId,
            planned_start_time: proposedStartTime,
            planned_end_time: new Date(proposedStartTime.getTime() + 8 * 60 * 60 * 1000), // Standard 8h pass
            status: 'SCHEDULED'
          });

      } catch (policyError: any) {
          console.error(`[HR Guardrail] ❌ Policy Violation Blocked! ${policyError.message}`);
      }

    } catch (err) {
      console.error('[HR] Fel vid validering/hantering av HR-händelse:', err);
    }
  });
}

start().catch(console.error);
