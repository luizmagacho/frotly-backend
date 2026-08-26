import { PartialType } from '@nestjs/mapped-types';
import { CreateLicensingDto } from './create-licensing.dto';

export class UpdateLicensingDto extends PartialType(CreateLicensingDto) {}
