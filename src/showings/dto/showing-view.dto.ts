import { ApiProperty } from '@nestjs/swagger';

/** Public response shape: film title and hall name instead of their ids. */
export class ShowingView {
  @ApiProperty({
    format: 'uuid',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  })
  id: string;

  @ApiProperty({ example: 'Interstellar' })
  filmTitle: string;

  @ApiProperty({ example: 'Red Hall' })
  hallName: string;

  @ApiProperty({
    example: '2030-01-15T18:00:00.000Z',
    description: 'ISO 8601, normalized to UTC',
  })
  startsAt: string;

  @ApiProperty({
    type: 'integer',
    example: 15000,
    description: 'Price per seat in kopecks',
  })
  price: number;
}
