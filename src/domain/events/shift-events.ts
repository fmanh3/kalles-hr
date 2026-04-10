import { z } from 'zod';

export const ShiftAssignmentRequestedSchema = z.object({
  driverId: z.string(),
  shiftId: z.string().optional(),
  proposedStartTime: z.string(),
  vehicleType: z.string().optional()
});

export type ShiftAssignmentRequested = z.infer<typeof ShiftAssignmentRequestedSchema>;
