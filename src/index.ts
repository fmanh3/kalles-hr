import { PubSubClient } from '../../kalles-traffic/src/infrastructure/messaging/pubsub-client';
import { ShiftAssignmentRequestedSchema, type ShiftAssignmentRequested } from './domain/events/shift-events';
import { DailyRestPolicy } from './domain/policies/daily-rest-policy';

async function start() {
  const pubsub = new PubSubClient();
  const HR_TOPIC = 'hr-events';
  const SUB_NAME = 'hr-guardrails-sub';

  console.log('--- KALLES HR: GUARDRAILS & POLICIES ---');

  // Låtsas-databas över förares senast avslutade pass
  const driverLastShiftEndTimes: Record<string, string> = {
    'FÖRARE-007': new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // Slutade för 5 timmar sedan (För kort vila!)
    'FÖRARE-008': new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString(), // Slutade för 15 timmar sedan (OK)
  };

  await pubsub.subscribe(HR_TOPIC, SUB_NAME, (event: ShiftAssignmentRequested) => {
    try {
      // Validera inkommande event
      const parsedEvent = ShiftAssignmentRequestedSchema.parse(event);
      console.log(`\n[HR Guardrail] Tar emot begäran om pass-tilldelning för ${parsedEvent.driverId}...`);

      const lastShiftEnd = driverLastShiftEndTimes[parsedEvent.driverId];
      if (!lastShiftEnd) {
         console.log(`[HR Guardrail] Ingen historik hittad för ${parsedEvent.driverId}. Tilldelning godkänd.`);
         return;
      }

      // Kör vår Policy (Guardrail)
      console.log(`[HR Guardrail] Utvärderar DailyRestPolicy (Min 11h vila). Förare slutade senast: ${new Date(lastShiftEnd).toLocaleString()}`);
      
      const lastEndTime = new Date(lastShiftEnd);
      const proposedStartTime = new Date(parsedEvent.proposedStartTime);
      
      try {
          DailyRestPolicy.evaluate(lastEndTime, proposedStartTime);
          console.log(`[HR Guardrail] ✅ Policy uppfylld. Föraren har haft tillräcklig dygnsvila. Godkänner tilldelning.`);
          // Här skulle vi i ett riktigt flöde publicera 'DriverAssignedToShift' eventet
      } catch (policyError: any) {
          console.error(`[HR Guardrail] ❌ Policy Violation Blocked! ${policyError.message}`);
          console.log(`[HR Guardrail] Pass-tilldelning avvisad av systemet.`);
          // Här skulle vi publicera ett 'ShiftAssignmentRejected' event
      }

    } catch (err) {
      console.error('[HR] Fel vid validering/hantering av HR-händelse:', err);
    }
  });
}

start().catch(console.error);
