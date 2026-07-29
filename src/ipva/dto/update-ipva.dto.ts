import { PartialType } from '@nestjs/mapped-types';
import { CreateIpvaDto } from './create-ipva.dto';

export class UpdateIpvaDto extends PartialType(CreateIpvaDto) {}
