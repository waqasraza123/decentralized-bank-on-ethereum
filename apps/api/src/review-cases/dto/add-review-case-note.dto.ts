import { IsNotEmpty, IsString } from "class-validator";

export class AddReviewCaseNoteDto {
  @IsString()
  @IsNotEmpty()
  note!: string;
}
