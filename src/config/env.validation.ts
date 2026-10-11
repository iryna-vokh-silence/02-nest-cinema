import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

/** "5432" -> 5432; anything that is not a plain integer stays as is (and fails IsInt). */
const toInt = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && /^\d+$/.test(value.trim())
    ? Number(value.trim())
    : value;

const required = { message: '$property is required' };

/** "true"/"false" -> boolean; anything else stays as is (and fails IsBoolean). */
const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

/**
 * Environment variables of the application. Described with the same
 * class-validator decorators as the DTOs and checked once at startup:
 * if a database parameter is missing or invalid, the application does not start.
 */
export class EnvironmentVariables {
  @Max(65535)
  @Min(1)
  @IsInt()
  @IsOptional()
  @Transform(toInt)
  PORT: number = 3000;

  @IsNotEmpty()
  @IsString()
  @IsDefined(required)
  DB_HOST: string;

  @Max(65535)
  @Min(1)
  @IsInt()
  @IsDefined(required)
  @Transform(toInt)
  DB_PORT: number;

  @IsNotEmpty()
  @IsString()
  @IsDefined(required)
  DB_USERNAME: string;

  // May be empty (e.g. trust authentication), but must be present.
  @IsString()
  @IsDefined(required)
  DB_PASSWORD: string;

  @IsNotEmpty()
  @IsString()
  @IsDefined(required)
  DB_NAME: string;

  /** Log SQL queries to the console. */
  @IsBoolean()
  @IsOptional()
  @Transform(toBoolean)
  DB_LOGGING: boolean = false;
}

/**
 * Used by ConfigModule.forRoot({ validate }) and by the TypeORM CLI data source.
 * Decorators run bottom-up and stop at the first failure (presence, type, range).
 * Returns the typed, converted config or throws with every problem listed.
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config);
  const errors = validateSync(validated, {
    skipMissingProperties: false,
    stopAtFirstError: true,
  });
  if (errors.length > 0) {
    const details = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return validated;
}
