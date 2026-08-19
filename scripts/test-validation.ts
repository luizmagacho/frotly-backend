import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDriverDto } from '../src/drivers/dto/create-driver.dto';

async function test() {
  const payload = {
    name: "João",
    cpf: "12345678901",
    licenseNumber: "01234567891",
    licenseCategory: "B",
    licenseExpiration: "2025-10-15T00:00:00.000Z",
    phone: "41999999999",
    email: "joao@email.com",
    status: "ACTIVE"
  };

  const instance = plainToInstance(CreateDriverDto, payload, { enableImplicitConversion: false });
  console.log("Instance:", instance);
  
  const errors = await validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  console.log("Validation Errors:");
  if (errors.length > 0) {
    errors.forEach(err => console.log(err.property, err.constraints));
  } else {
    console.log("No errors! Passed.");
  }
}
test();
