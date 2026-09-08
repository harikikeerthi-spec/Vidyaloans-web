import { IsBoolean, IsOptional, IsArray, IsString } from 'class-validator';

export class UpdateEmailStateDto {
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @IsBoolean()
  isStarred?: boolean;

  @IsOptional()
  @IsBoolean()
  isSpam?: boolean | null;

  @IsOptional()
  @IsBoolean()
  isTrashed?: boolean;
}

export class BatchUpdateEmailStateDto extends UpdateEmailStateDto {
  @IsArray()
  @IsString({ each: true })
  emailIds: string[];
}
