import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetPaymentMethodDto {
  @ApiProperty({ description: 'ID do Payment Method do Stripe' })
  @IsString()
  paymentMethodId: string;
}
