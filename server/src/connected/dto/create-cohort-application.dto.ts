import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCohortApplicationDto {
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    phone: string;

    @IsString()
    @IsNotEmpty()
    targetIntake: string;

    @IsString()
    @IsOptional()
    destination?: string;

    @IsString()
    @IsOptional()
    university?: string;

    @IsString()
    @IsOptional()
    course?: string;

    @IsBoolean()
    @IsOptional()
    gapYear?: boolean;

    @IsString()
    @IsOptional()
    message?: string;

    @IsString()
    @IsOptional()
    source?: string;
}
