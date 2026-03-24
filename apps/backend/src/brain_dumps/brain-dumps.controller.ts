import { Controller } from '@nestjs/common';
import { BrainDumpsService } from './brain-dumps.service';

@Controller('brain-dumps')
export class BrainDumpsController {
  constructor(private readonly brainDumpsService: BrainDumpsService) {}
}
