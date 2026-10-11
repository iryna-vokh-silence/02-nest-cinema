import { DataSource } from 'typeorm';

/** Empties every application table (the schema itself stays). */
export async function truncateAll(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'TRUNCATE TABLE "booking_seats", "bookings", "showings", "halls", "films" RESTART IDENTITY CASCADE',
  );
}
