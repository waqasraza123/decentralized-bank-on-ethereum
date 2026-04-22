import { Matches, ValidateIf } from "class-validator";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class UpdateCustomerAgeProfileDto {
  @ValidateIf((_object, value) => value !== null)
  @Matches(DATE_ONLY_PATTERN, {
    message: "dateOfBirth must use YYYY-MM-DD format.",
  })
  dateOfBirth: string | null = null;
}
