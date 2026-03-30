import { DailyRestPolicy } from './daily-rest-policy';

describe('DailyRestPolicy', () => {
  it('should approve if rest is exactly 11 hours', () => {
    const lastShiftEndTime = new Date('2026-03-26T00:00:00Z');
    const proposedShiftStartTime = new Date('2026-03-26T11:00:00Z');
    expect(DailyRestPolicy.evaluate(lastShiftEndTime, proposedShiftStartTime)).toBe(true);
  });

  it('should approve if rest is more than 11 hours', () => {
    const lastShiftEndTime = new Date('2026-03-26T00:00:00Z');
    const proposedShiftStartTime = new Date('2026-03-26T12:00:00Z');
    expect(DailyRestPolicy.evaluate(lastShiftEndTime, proposedShiftStartTime)).toBe(true);
  });

  it('should throw Error if rest is less than 11 hours', () => {
    const lastShiftEndTime = new Date('2026-03-26T00:00:00Z');
    const proposedShiftStartTime = new Date('2026-03-26T10:00:00Z'); // Only 10 hours
    expect(() => DailyRestPolicy.evaluate(lastShiftEndTime, proposedShiftStartTime)).toThrow(
      /Insufficient Rest/
    );
  });
});