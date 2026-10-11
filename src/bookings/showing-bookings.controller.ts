import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingResponseDto } from './dto/booking-response.dto';

/**
 * Bookings of a single showing. Lives in the bookings module so that
 * ShowingsModule never needs to depend on BookingsModule.
 */
@ApiTags('bookings')
@Controller('showings/:id/bookings')
export class ShowingBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({
    summary: 'Book seats for a showing (all-or-nothing)',
    description:
      'The booking and all its seats are written in one database transaction. ' +
      'If any seat is already taken (unique index on showing_id, row, seat), the ' +
      'transaction is rolled back and nothing is stored.',
  })
  @ApiCreatedResponse({
    type: BookingResponseDto,
    description: 'Booking created',
  })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description:
      'Empty array, invalid/non-positive numbers, duplicate seat, or seat outside the hall',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Showing not found',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'At least one seat is already booked; nothing is booked',
  })
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBookingDto,
  ): Promise<BookingResponseDto> {
    return this.bookingsService.create(id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List bookings of a showing' })
  @ApiOkResponse({ type: BookingResponseDto, isArray: true })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'id is not a UUID',
  })
  @ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'Showing not found',
  })
  findByShowing(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BookingResponseDto[]> {
    return this.bookingsService.findByShowing(id);
  }
}
