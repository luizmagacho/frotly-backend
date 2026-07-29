import { PartialType } from '@nestjs/mapped-types';
import { CreateRefuelDto } from './create-refuel.dto';

export class UpdateRefuelDto extends PartialType(CreateRefuelDto) {}
