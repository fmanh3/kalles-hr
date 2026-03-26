import { differenceInHours } from 'date-fns';

/**
 * Policy: "Minst 11 timmars dygnsvila mellan arbetspass"
 * Ref: kalles-governance/policies/personal-hr/policy-dygnsvila.md
 */
export class DailyRestPolicy {
  private static MINIMUM_REST_HOURS = 11;

  /**
   * Utvärderar om en förare har fått tillräckligt med vila innan ett nytt pass.
   * @param lastShiftEndTime Tidpunkten då det senaste passet avslutades.
   * @param proposedShiftStartTime Tidpunkten då det nya passet föreslås starta.
   * @returns true om policyn uppfylls, kastar Error annars.
   */
  public static evaluate(lastShiftEndTime: Date, proposedShiftStartTime: Date): boolean {
    const hoursOfRest = differenceInHours(proposedShiftStartTime, lastShiftEndTime);

    if (hoursOfRest < this.MINIMUM_REST_HOURS) {
      throw new Error(
        `Policy Violation: Insufficient Rest. Driver only had ${hoursOfRest} hours of rest. Minimum required is ${this.MINIMUM_REST_HOURS} hours.`
      );
    }

    return true;
  }
}
