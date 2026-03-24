import { Test, TestingModule } from '@nestjs/testing';
import { BrainDumpsService } from './brain-dumps.service';

describe('BrainDumpsService', () => {
  let service: BrainDumpsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BrainDumpsService],
    }).compile();

    service = module.get<BrainDumpsService>(BrainDumpsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
